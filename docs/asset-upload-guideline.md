# Diretriz de Upload de Assets com Vercel Blob

## Objetivo

Padronizar o upload de imagens e arquivos do painel admin usando:

- Vercel Blob para armazenar os binários
- Neon/Postgres para armazenar metadados e vínculo com o conteúdo
- Rotas dedicadas de upload no backend Hono

Esta diretriz deve ser seguida para a `heroSection` e para futuras rotas de upload de imagem do projeto.

## Decisões Arquiteturais

1. Binários não serão salvos no Postgres.
   O banco guardará apenas metadados e o vínculo com a entidade/slot do conteúdo.

2. Upload será feito server-side pelo backend.
   Motivos:
   - o painel já conversa com a API Hono
   - haverá validação e conversão antes do upload
   - os arquivos esperados são pequenos o suficiente para esse fluxo

3. Assets públicos devem usar Vercel Blob com `access: "public"`.
   O backend fará upload usando `@vercel/blob` e `TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN`.

4. Imagens devem ser convertidas antes do upload.
   Regra inicial:
   - imagens: converter para `webp`
   - PDF: manter `pdf`

5. Endpoints JSON de conteúdo e endpoints binários devem ser separados.
   Exemplo:
   - `PUT /api/content/admin/hero-section` continua responsável pelo conteúdo textual
   - `POST /api/content/admin/hero-section/:topicIndex/image` fica responsável pelo upload da imagem

6. O `draftContent` continua sendo a fonte de edição.
   O upload de imagem atualiza apenas o rascunho. O conteúdo publicado só muda quando a ação de publish for executada.

## Fluxo Recomendado

1. O admin envia `multipart/form-data` para a API.
2. A API valida autenticação, tipo do arquivo e tamanho.
3. A API converte a imagem para `webp`.
4. A API envia o arquivo convertido para o Vercel Blob.
5. A API salva os metadados no Neon.
6. A API atualiza o campo de imagem no `draftContent`.
7. Em substituição, a API remove o asset antigo do Blob em modo best-effort.

## Hero Section: Primeira Implementação

### Rota

`POST /api/content/admin/hero-section/:topicIndex/image`

### Autorização

Mesma regra já usada no admin de conteúdo:

- `MASTER`
- `ADMIN`

### Path params

- `topicIndex`: índice do tópico do Hero

Regras:

- valor inteiro
- intervalo permitido: `0`, `1` ou `2`
- o tópico precisa existir no `heroSection` atual

### Body

`multipart/form-data`

Campos:

- `file`: obrigatório
- `alt`: opcional

### Regras de validação

- aceitar apenas imagem
- tipos iniciais permitidos: `image/jpeg`, `image/png`, `image/webp`
- limitar tamanho de upload no backend
- recomendação inicial: `4 MB` como limite operacional

Observação:
o ChatGPT citou o limite prático de upload server-side em funções da Vercel. Mesmo quando o arquivo médio estiver em torno de `2 MB`, o backend deve impor um limite explícito para proteger memória, tempo de execução e evitar uploads fora do perfil esperado.

### Conversão

Sugestão inicial:

- biblioteca: `sharp`
- saída: `webp`
- qualidade inicial: `82`
- remover metadados EXIF quando possível

### Pathname no Blob

Usar pathname único por upload. Evitar sobrescrever o mesmo arquivo.

Exemplo:

`landing-page/home/hero-section/topic-0/2026-04-13T12-30-00Z-cover.webp`

Motivo:

- evita servir asset antigo em cache/CDN
- facilita rollback e diagnóstico
- simplifica troca de imagem

Mesmo que o Blob permita `allowOverwrite`, o padrão do projeto deve ser criar uma URL nova a cada substituição.

## Estratégia de Persistência

### Conteúdo

O campo `image` dentro do `heroSection` continua armazenando a URL pública final do Blob.

Exemplo:

```json
[
  {
    "title": "Bem-vindo a Tessa",
    "description": "Conteúdo do Hero",
    "image": "https://...public.blob.vercel-storage.com/landing-page/home/hero-section/topic-0/2026-04-13T12-30-00Z-cover.webp",
    "button": {
      "text": "Saiba mais",
      "url": "https://example.com"
    }
  }
]
```

### Metadados no banco

Criar uma tabela/modelo de assets.

Campos recomendados:

- `id`
- `kind`
- `entityType`
- `entityId`
- `sectionKey`
- `fieldKey`
- `slot`
- `pathname`
- `url`
- `mimeType`
- `sizeBytes`
- `originalFilename`
- `alt`
- `createdAt`
- `updatedAt`
- `createdById`

### Convenção recomendada para o Hero

- `kind`: `image`
- `entityType`: `landingPage`
- `entityId`: `home`
- `sectionKey`: `heroSection`
- `fieldKey`: `image`
- `slot`: índice do tópico (`0`, `1`, `2`)

Observação:
como os tópicos do Hero ainda não possuem `id` próprio, o vínculo inicial será posicional via `slot`.

## Ordem Segura de Substituição

Para trocar a imagem de um tópico:

1. Ler o `draftContent` atual e localizar a URL antiga.
2. Fazer upload do novo arquivo convertido para o Blob.
3. Atualizar banco e `draftContent` para apontar para a nova URL.
4. Tentar apagar o blob antigo em modo best-effort.

Regra importante:

- se o upload no Blob der certo e a atualização no banco falhar, o backend deve tentar apagar imediatamente o blob recém-criado para evitar lixo órfão
- se a atualização no banco der certo e a remoção do blob antigo falhar, o sistema não deve quebrar a resposta do usuário; registrar log e seguir

## Resposta da Rota

Resposta sugerida:

```json
{
  "asset": {
    "id": "string",
    "kind": "image",
    "entityType": "landingPage",
    "entityId": "home",
    "sectionKey": "heroSection",
    "fieldKey": "image",
    "slot": 0,
    "pathname": "landing-page/home/hero-section/topic-0/2026-04-13T12-30-00Z-cover.webp",
    "url": "https://...public.blob.vercel-storage.com/.../cover.webp",
    "mimeType": "image/webp",
    "sizeBytes": 182340,
    "alt": "Banner principal",
    "createdAt": "2026-04-13T12:30:00.000Z"
  },
  "heroSection": [
    {
      "title": "Bem-vindo a Tessa",
      "description": "Conteúdo do Hero",
      "image": "https://...public.blob.vercel-storage.com/.../cover.webp",
      "button": {
        "text": "Saiba mais",
        "url": "https://example.com"
      }
    }
  ]
}
```

## Estrutura de Código Recomendada

### Dependências

- `@vercel/blob`
- `sharp`

### Arquivos sugeridos

- `src/modules/assets/assets.schemas.ts`
- `src/modules/assets/assets.service.ts`
- `src/modules/assets/assets.utils.ts`
- integração da rota específica em `src/modules/content/content.admin-router.ts`

### Responsabilidades

- módulo `assets`: upload, conversão, pathname, delete, persistência de metadados
- módulo `content`: localizar slot correto e atualizar `draftContent`

## Variáveis de Ambiente

Adicionar ao schema de ambiente:

- `TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN`
- `ASSET_MAX_UPLOAD_BYTES`

Valor inicial sugerido:

- `ASSET_MAX_UPLOAD_BYTES=4194304`

## Convenções para Próximas Rotas

Para novos uploads, seguir este padrão:

1. Criar rota binária dedicada dentro do contexto do recurso.
2. Não misturar arquivo com payload JSON de edição textual.
3. Converter antes do upload sempre que o tipo permitir.
4. Salvar URL final no conteúdo publicado/rascunho.
5. Salvar metadados completos no banco.
6. Usar pathname único e evitar overwrite.
7. Remover asset antigo em best-effort após swap bem-sucedido.

Exemplos futuros:

- `POST /api/content/admin/scenery-section/image`
- `POST /api/content/admin/services-pages/:slug/image`
- `POST /api/content/admin/company-information/logo`

## Plano de Implementação

1. Adicionar `@vercel/blob` e `sharp`.
2. Criar modelo Prisma para assets.
3. Criar migration do novo modelo.
4. Expandir `env.ts` e `.env.example`.
5. Implementar serviço de upload e delete no Blob.
6. Implementar conversão para `webp`.
7. Implementar a rota `POST /api/content/admin/hero-section/:topicIndex/image`.
8. Atualizar o `draftContent.heroSection[topicIndex].image` com a URL pública.
9. Salvar metadados do asset.
10. Atualizar Postman e README.

## Contexto Curto para IA

Use este texto como contexto em tarefas futuras:

```text
Neste projeto, uploads de imagem do admin devem usar Vercel Blob para armazenar binários e Neon/Postgres apenas para metadados. O backend Hono é responsável por receber multipart/form-data, validar o arquivo, converter imagens para WebP, fazer upload server-side com @vercel/blob usando TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN e salvar a URL pública no draftContent. Para a heroSection, a rota planejada é POST /api/content/admin/hero-section/:topicIndex/image, com topicIndex entre 0 e 2. O campo heroSection[topicIndex].image deve armazenar a URL pública final do Blob. A substituição deve usar pathname único por upload, atualizar banco/conteúdo primeiro e apagar o blob antigo em best-effort depois. Metadados do asset devem ser salvos em tabela própria no banco.
```
