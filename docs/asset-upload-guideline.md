# Diretriz de Upload de Assets com Vercel Blob

## Objetivo

Padronizar uploads do painel admin usando:

- Vercel Blob para armazenar binários
- Neon/Postgres para armazenar metadados e vínculo com o conteúdo
- Backend Hono como responsável por validação, conversão e persistência

Esta diretriz vale para a `heroSection` e deve servir de base para futuras rotas de imagem do projeto.

## Decisões Arquiteturais

1. Binários não serão salvos no Postgres.
   O banco guarda apenas metadados e a ligação do asset com o conteúdo.

2. O upload é server-side.
   O painel envia o arquivo para a API Hono, e a API faz a conversão e o upload no Blob.

3. Assets públicos usam Vercel Blob com `access: "public"`.
   O backend usa `@vercel/blob` com `BLOB_READ_WRITE_TOKEN`.

4. Imagens são convertidas antes do upload.
   Regra inicial:
   - imagens em `jpg` e `png`: converter para `webp`
   - imagens em `webp`: manter em `webp` sem reconversão
   - PDF: manter `pdf`

5. Para seções de conteúdo como Hero, o endpoint de salvar conteúdo e o upload devem funcionar juntos.
   Preferência do projeto:
   - `POST /api/content/admin/hero-section`
   - `PUT /api/content/admin/hero-section`

6. Os endpoints do Hero aceitam dois formatos:
   - `application/json` quando as imagens já são URLs finais
   - `multipart/form-data` quando texto e imagens são enviados no mesmo request

7. O `draftContent` continua sendo a fonte de edição.
   O upload altera apenas o rascunho. O conteúdo publicado só muda no publish.

## Formato Recomendado para Multipart

O request deve usar `multipart/form-data` com:

- `payload`: JSON em texto contendo o array do `heroSection`
- `image_0`, `image_1`, `image_2`: arquivos opcionais
- `alt_0`, `alt_1`, `alt_2`: textos opcionais

### Exemplo de payload

```json
[
  {
    "title": "Bem-vindo a Tessa",
    "description": "Conteúdo do Hero",
    "button": {
      "text": "Saiba mais",
      "url": "https://example.com"
    }
  },
  {
    "title": "Conheça nossos serviços",
    "description": "Veja as principais soluções",
    "button": {
      "text": "Ver serviços",
      "url": "https://example.com/servicos"
    }
  }
]
```

### Regras do payload

- o Hero aceita de `1` a `3` tópicos
- `title`, `description` e `button` são obrigatórios
- `image` pode ser omitido no multipart se vier um arquivo `image_n`
- no `PUT`, se não vier `image_n` e o item também não trouxer `image`, a API preserva a imagem atual daquele slot
- no `POST`, cada item precisa terminar com uma imagem resolvida, seja por arquivo ou por URL já presente no payload

## Hero Section: Implementação Atual

### Rotas

- `POST /api/content/admin/hero-section`
- `PUT /api/content/admin/hero-section`
- `DELETE /api/content/admin/hero-section`

### Autorização

Mesma regra já usada no admin de conteúdo:

- `MASTER`
- `ADMIN`

### Validações iniciais de arquivo

- aceitar apenas imagem
- tipos permitidos: `image/jpeg`, `image/png`, `image/webp`
- limitar tamanho no backend
- valor inicial recomendado: `4 MB`

Observação:
mesmo com arquivos médios pequenos, o backend deve impor um limite explícito para proteger memória e tempo de execução da função.

### Conversão

Configuração inicial:

- biblioteca: `sharp`
- saída: `webp`
- qualidade inicial: `82`
- aplicar `rotate()` para respeitar EXIF

## Fluxo Recomendado

1. O admin envia JSON puro ou multipart.
2. A API valida autenticação, payload, tipo do arquivo e tamanho.
3. A API converte imagens recebidas para `webp`.
4. A API envia os arquivos convertidos para o Vercel Blob.
5. A API monta o `heroSection` final com URLs públicas.
6. A API atualiza o `draftContent`.
7. A API recria os metadados da `heroSection` na tabela `Asset`.
8. A API remove blobs antigos que deixaram de ser usados, em modo best-effort.

## Pathname no Blob

Usar pathname único por upload. Não usar overwrite como padrão.

Exemplo:

`landing-page/home/hero-section/topic-0/2026-04-13T12-30-00Z-cover.webp`

Motivos:

- evita servir arquivo antigo em cache/CDN
- simplifica troca e rollback
- reduz risco de inconsistência entre conteúdo e asset

## Estratégia de Persistência

### Conteúdo

O campo `image` dentro do `heroSection` continua guardando a URL pública final.

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

### Convenção atual do Hero

- `kind`: `image`
- `entityType`: `landingPage`
- `entityId`: `home`
- `sectionKey`: `heroSection`
- `fieldKey`: `image`
- `slot`: índice do tópico (`0`, `1`, `2`)

Observação:
o vínculo atual é posicional. Se no futuro o Hero passar a ter reorder frequente, vale considerar um `id` por tópico.

## Ordem Segura de Substituição

1. Ler o Hero atual e os assets vinculados.
2. Fazer upload dos novos arquivos.
3. Persistir o `heroSection` final e os metadados em transação.
4. Se a transação falhar, apagar os blobs recém-criados.
5. Depois de sucesso, apagar blobs antigos que deixaram de ser usados.

Regras importantes:

- se o upload no Blob der certo e a persistência falhar, os novos blobs devem ser limpos
- se a persistência der certo e a remoção dos blobs antigos falhar, a resposta do usuário não deve quebrar; apenas registrar log

## Estrutura de Código Recomendada

### Dependências

- `@vercel/blob`
- `sharp`

### Arquivos sugeridos

- `src/modules/assets/assets.schemas.ts`
- `src/modules/assets/assets.service.ts`
- `src/modules/assets/assets.utils.ts`
- integração do recurso no módulo de conteúdo

### Responsabilidades

- módulo `assets`: upload, delete, conversão, pathname e helpers
- módulo `content`: composição do payload final e persistência do `draftContent`

## Variáveis de Ambiente

- `BLOB_READ_WRITE_TOKEN`
- `ASSET_MAX_UPLOAD_BYTES`

Valor inicial sugerido:

- `ASSET_MAX_UPLOAD_BYTES=4194304`

## Convenções para Próximas Rotas

Para novos uploads de seções semelhantes:

1. Preferir o mesmo endpoint de `POST`/`PUT` do recurso, com suporte a JSON e multipart.
2. Usar um campo `payload` para o JSON estrutural.
3. Nomear arquivos por slot ou campo, como `image_0`, `image_1`, `logo`, `cover`.
4. Converter imagens antes do upload.
5. Salvar a URL final no conteúdo.
6. Salvar metadados completos no banco.
7. Usar pathname único por upload.
8. Limpar blobs antigos em best-effort após sucesso.

Exemplos futuros:

- `PUT /api/content/admin/services-pages/:slug` com `payload` + `image`
- `PUT /api/content/admin/company-information` com `payload` + `logo`
- `PUT /api/content/admin/operation-section` com `payload` + `image_0` até `image_19`

Regras específicas já adotadas na `operationSection`:

- até `20` fotos por request
- cada arquivo deve ter no máximo `3 MB`
- quando alguma foto ultrapassa o limite, a API retorna erro apontando o campo exato, como `image_7`
- no multipart, o campo `payload` é opcional quando o request só envia arquivos

## Plano de Implementação Base

1. Adicionar `@vercel/blob` e `sharp`.
2. Criar tabela/modelo `Asset`.
3. Adicionar migration.
4. Expandir `env.ts` e `.env.example`.
5. Implementar upload e delete no Blob.
6. Implementar conversão para `webp`.
7. Fazer `POST` e `PUT` do recurso aceitarem JSON e multipart.
8. Atualizar o `draftContent` com a URL pública final.
9. Persistir metadados dos assets.
10. Atualizar README e Postman.

## Contexto Curto para IA

```text
Neste projeto, uploads de imagem do admin devem usar Vercel Blob para armazenar binários e Neon/Postgres apenas para metadados. O backend Hono recebe JSON puro ou multipart/form-data. Quando o request for multipart, ele recebe um campo payload com o JSON estrutural e campos de arquivo como image_0, image_1, image_2. O backend valida o payload, converte imagens para WebP, faz upload server-side com @vercel/blob usando BLOB_READ_WRITE_TOKEN e salva a URL pública final no draftContent. Para a heroSection, POST e PUT /api/content/admin/hero-section devem aceitar esse fluxo integrado. O campo heroSection[n].image deve armazenar a URL pública do Blob. A substituição deve usar pathname único por upload, persistir conteúdo e metadados em transação e apagar blobs antigos em best-effort depois.
```
