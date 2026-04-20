# Database Schema — Tessa API

Banco PostgreSQL gerenciado via Prisma. Arquivo fonte: `prisma/schema.prisma`. Diagrama DBML em `docs/database-schema.dbml` (compatível com [dbdiagram.io](https://dbdiagram.io/d)).

## Visão geral

Entidades principais:

| Tabela        | Propósito                                                                         |
| ------------- | --------------------------------------------------------------------------------- |
| `User`        | Usuários administrativos (MASTER/ADMIN) que operam o CMS                          |
| `LandingPage` | Páginas com conteúdo estruturado (rascunho + publicado em JSON)                   |
| `BlogArticle` | Artigos de blog com autor, slug e categoria                                       |
| `Contact`     | Leads capturados via formulário público                                           |
| `NpsResponse` | Respostas de NPS submetidas por terceiros (nota 0-10), moderadas por admin        |
| `Testimonial` | Depoimentos submetidos por visitantes (nota 1-5 + fotos opcionais), moderados     |
| `Asset`       | Metadados de mídia (imagens) hospedadas em `@vercel/blob`                         |

Todos os IDs são `String` `cuid()`. Datas usam `DateTime` com `now()`/`@updatedAt`.

## Enums

- **`UserRole`**: `MASTER`, `ADMIN`. Define nível de permissão.
- **`LandingPageStatus`**: `draft`, `published`. Controla qual conteúdo é servido publicamente (`publishedContent` vs `draftContent`).
- **`NpsResponseStatus`**: `pending`, `approved`, `rejected`. Fluxo de moderação das respostas de NPS.
- **`TestimonialStatus`**: `pending`, `approved`, `rejected`. Fluxo de moderação dos depoimentos.

## Entidades e campos relevantes

### `User`

Conta administrativa. `email` único, `passwordHash` via `bcryptjs`. `isActive` permite desativar sem deletar (preserva integridade referencial).

### `LandingPage`

CMS de páginas. Dois campos JSON: `draftContent` (sempre presente, em edição) e `publishedContent` (snapshot da última publicação). `slug` único define a URL pública. Auditoria via `updatedById` (obrigatório) e `publishedById` (opcional, presente após primeira publicação).

> **Importante:** seções (hero, operação, informações da empresa), serviços, categorias, representantes e perguntas de NPS **não são tabelas separadas**. São conteúdo estruturado dentro do JSON `draftContent`/`publishedContent`. Ver seção "Estrutura de conteúdo (JSON)" abaixo.

### `BlogArticle`

Artigo único por `slug`. `content` em texto puro/markdown. `categorySlug` é string livre (sem tabela `Category` — desnormalizado). Índices em `categorySlug` e `publishedAt` aceleram listagens públicas.

### `Contact`

Lead bruto de formulário. Sem relação — entidade isolada. `hasBeenContacted` marca atendimento manual. Índice em `createdAt` para ordenação cronológica.

### `NpsResponse`

Resposta de NPS submetida publicamente, entra como `pending`. Nota `score` de `0` a `10` (padrão NPS). Admin aprova/rejeita preenchendo `reviewedById` + `reviewedAt`. Índice composto `(status, createdAt)` otimiza fila de moderação.

### `Testimonial`

Depoimento submetido publicamente pelo formulário da landing. Entra como `pending`. Nota `rating` de `1` a `5` estrelas. Aceita duas imagens opcionais armazenadas no Vercel Blob: `profileImageUrl` (foto de perfil do autor) e `reviewImageUrl` (foto ilustrativa da avaliação do serviço). Os campos `profileImagePathname` e `reviewImagePathname` guardam o caminho interno do blob para facilitar limpeza em `delete`. Admin aprova/rejeita preenchendo `reviewedById` + `reviewedAt`. Índice composto `(status, createdAt)` otimiza fila de moderação.

### `Asset`

Tabela polimórfica de mídia. Em vez de FK direta, usa `entityType` + `entityId` (+ `sectionKey`/`fieldKey`/`slot` opcionais) para apontar para qualquer dono — `LandingPage`, `BlogArticle`, etc. URL e `pathname` apontam para o blob no Vercel Blob Storage. Detalhes do fluxo: `docs/asset-upload-guideline.md`.

## Relações

Todas as FKs apontam para `User.id` (o usuário é o único hub de auditoria):

```
User 1 ───< LandingPage   (updatedBy   — obrigatório)
User 1 ───< LandingPage   (publishedBy — opcional)
User 1 ───< BlogArticle   (author      — obrigatório)
User 1 ───< NpsResponse   (reviewedBy  — opcional)
User 1 ───< Testimonial   (reviewedBy  — opcional)
User 1 ───< Asset         (createdBy   — obrigatório)
```

`Contact` não tem relação. `Asset` não usa FK para o dono do recurso — vínculo é feito por par `(entityType, entityId)` em consulta na aplicação.

### Comportamento de delete

Sem `onDelete` configurado → padrão Prisma/Postgres é `Restrict`. Não dá pra deletar um `User` que tenha registros relacionados; use `isActive = false`.

## Estrutura de conteúdo (JSON)

Decisão de modelagem: o CMS é **document-oriented**. Ao invés de criar uma tabela por tipo de conteúdo editorial, tudo vive como JSON dentro de `LandingPage.draftContent` / `publishedContent`. Isso dá flexibilidade ao editor (adicionar/reordenar seções sem migration) ao custo de perder validação no nível do banco — a validação é feita via schemas Zod em `src/modules/content/content.schemas.ts`.

Config fonte: `src/modules/content/content.config.ts`.

### Seções singulares (uma instância por página)

Chaves fixas dentro do JSON:

| Chave JSON           | Path da rota admin    | Descrição                         |
| -------------------- | --------------------- | --------------------------------- |
| `heroSection`        | `hero-section`        | Seção hero (topo da página)       |
| `operationSection`   | `operation-section`   | Seção "como operamos"             |
| `companyInformation` | `company-information` | Informações institucionais        |

### Coleções (arrays de itens dentro do JSON)

Cada item tem ID próprio gerado no app, não no banco:

| Chave JSON          | Path da rota admin    | Descrição                                  |
| ------------------- | --------------------- | ------------------------------------------ |
| `nps`               | `nps`                 | Perguntas de NPS exibidas publicamente     |
| `representantsBase` | `representants-base`  | Representantes/vendedores                  |
| `categories`        | `categories`          | Categorias usadas em blog e serviços       |
| `clients`           | `clients`             | Logos de clientes (upload PNG pelo admin)  |

### Páginas de serviço

Config especial `servicesPagesConfig` (`key: "servicesPages"`, path `services-pages`): coleção de páginas de serviço, também armazenada como array no mesmo JSON.

### Esqueleto aproximado do JSON

```jsonc
{
  "heroSection":        { /* heroSectionSchema */ },
  "operationSection":   { /* operationSectionSchema */ },
  "companyInformation": { /* companyInformationSchema */ },
  "nps":                [ /* npsItemSchema[] */ ],
  "representantsBase":  [ /* representantSchema[] */ ],
  "categories":         [ /* categorySchema[] */ ],
  "clients":            [ /* clientItemSchema[] */ ],
  "servicesPages":      [ /* servicesPageItemSchema[] */ ]
}
```

### Implicações

- **Mídia relacionada** (imagens de hero, de serviço, de representante, etc.) vive em `Asset` apontando para `LandingPage` via `entityType="landingPage"` + `entityId=<LandingPage.id>` + `sectionKey`/`fieldKey`/`slot` identificando o slot exato dentro do JSON.
- **Integridade referencial** entre, por exemplo, um `BlogArticle.categorySlug` e uma categoria dentro de `categories[]` **não é garantida pelo banco** — é responsabilidade da aplicação.
- **Queries por conteúdo interno** (ex.: "listar todos serviços") são feitas lendo + parseando o JSON; não use para filtros pesados.
- **Versionamento**: publicação = copiar `draftContent` → `publishedContent`. Não há histórico de versões anteriores.

## Índices

| Tabela        | Índice                                                | Motivo                                |
| ------------- | ----------------------------------------------------- | ------------------------------------- |
| `User`        | `email` (unique)                                      | Login                                 |
| `LandingPage` | `slug` (unique)                                       | Roteamento público                    |
| `BlogArticle` | `slug` (unique), `categorySlug`, `publishedAt`        | Roteamento + listagens                |
| `Contact`     | `createdAt`                                           | Ordenação no painel admin             |
| `NpsResponse` | `(status, createdAt)`, `createdAt`                    | Fila de moderação + listagem          |
| `Asset`       | `pathname`, `url`, `(entityType,entityId,sectionKey,fieldKey,slot)` | Lookup por dono e por blob   |

## Como visualizar o ERD

1. Abrir <https://dbdiagram.io/d>
2. Colar o conteúdo de `docs/database-schema.dbml` no editor
3. Diagrama renderiza automaticamente

## Como manter sincronizado

Ao alterar `prisma/schema.prisma`:

1. Atualizar `docs/database-schema.dbml` com o mesmo delta (tabelas, campos, enums, refs)
2. Atualizar este `.md` se a relação ou semântica mudar
3. Rodar `pnpm prisma:migrate` para gerar a migration
