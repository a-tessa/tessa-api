# Tessa API

API de gerenciamento de conteúdo para a landing page SSR da Tessa, preparada para deploy na Vercel.

O deploy continua sem Docker na Vercel. O Docker deste projeto existe apenas para subir o PostgreSQL local durante o desenvolvimento.

## Stack

- Hono para rotas HTTP leves e compatíveis com Vercel Functions
- Prisma com PostgreSQL
- JWT para autenticação
- Perfis `MASTER` e `ADMIN`

## Fluxo inicial

1. Configure as variáveis de ambiente com base no arquivo `.env.example`.
2. Suba o banco local com Docker.
3. Instale as dependências.
4. Gere o cliente Prisma.
5. Rode as migrations.
6. Faça o bootstrap do usuário master.

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://tessa:tessa@localhost:5434/tessa_local?schema=public"
DATABASE_URL_UNPOOLED="postgresql://tessa:tessa@localhost:5434/tessa_local?schema=public"
JWT_SECRET="change-me-min-16-chars"
MASTER_SETUP_KEY="change-me-min-8"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token"
ASSET_MAX_UPLOAD_BYTES="4194304"
```

## Scripts

```bash
pnpm db:start
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:migrate:deploy
pnpm dev
```

## Banco local com Docker

O arquivo [docker-compose.yml](/home/luisfaf/tessa/tessa-api/docker-compose.yml) sobe um PostgreSQL local em `localhost:5434` com estas credenciais de desenvolvimento:

```env
POSTGRES_DB=tessa_local
POSTGRES_USER=tessa
POSTGRES_PASSWORD=tessa
```

Comandos úteis:

```bash
pnpm db:start
pnpm db:logs
pnpm db:stop
pnpm db:down
```

Fluxo sugerido para o primeiro uso:

```bash
cp .env.example .env
pnpm db:start
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Se você já tinha um `.env` antigo, atualize a `DATABASE_URL` manualmente para:

```env
DATABASE_URL="postgresql://tessa:tessa@localhost:5434/tessa_local?schema=public"
DATABASE_URL_UNPOOLED="postgresql://tessa:tessa@localhost:5434/tessa_local?schema=public"
```

## Publicar na Vercel

Forma mais simples:

1. Suba este projeto para um repositório Git.
2. Na Vercel, adicione uma integração de Postgres pelo Marketplace.
3. Escolha Neon.
4. Importe ou conecte este repositório na Vercel.
5. Confirme as variáveis de ambiente injetadas pela integração.
6. Faça o deploy.
7. Rode as migrations no banco de produção.

### Variáveis de ambiente na Vercel

Com Neon conectado à Vercel, o ideal é ter pelo menos estas variáveis:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler:5432/tessa_prod?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST:5432/tessa_prod?sslmode=require"
JWT_SECRET="uma-chave-bem-grande-e-segura"
MASTER_SETUP_KEY="uma-chave-secreta-para-bootstrap"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token"
ASSET_MAX_UPLOAD_BYTES="4194304"
```

Importante:

- `DATABASE_URL` deve ser a conexão poolada usada no runtime
- `DATABASE_URL_UNPOOLED` deve ser a conexão direta usada pelo Prisma CLI para migrations
- `BLOB_READ_WRITE_TOKEN` deve ser o token do Vercel Blob conectado ao projeto
- não use a `DATABASE_URL` local do Docker na Vercel
- a Vercel não vai hospedar seu Postgres local
- o Docker deste projeto é apenas para desenvolvimento

### O que já está adequado neste repositório

- [prisma/schema.prisma](/home/luisfaf/tessa/tessa-api/prisma/schema.prisma) agora usa `directUrl = env("DATABASE_URL_UNPOOLED")`
- [src/lib/prisma.ts](/home/luisfaf/tessa/tessa-api/src/lib/prisma.ts) já usa singleton do Prisma Client
- [package.json](/home/luisfaf/tessa/tessa-api/package.json) já tem `prisma:migrate:deploy`

### Build na Vercel

O projeto já está preparado para deploy porque:

- [src/app.ts](/home/luisfaf/tessa/tessa-api/src/app.ts) exporta o app Hono como `default`
- [package.json](/home/luisfaf/tessa/tessa-api/package.json) já roda `prisma generate` no `postinstall` e no `build`

Se quiser definir manualmente na dashboard da Vercel:

- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: deixe vazio

### Migrations em produção

Depois que a Vercel estiver com as env vars corretas, rode as migrations contra o banco de produção:

```bash
pnpm install
pnpm prisma:migrate:deploy
```

Se você ativar Preview Branching no Neon, uma opção prática é configurar nos previews um build command que aplique migrations antes do build:

```bash
pnpm prisma:migrate:deploy && pnpm build
```

Para produção, eu manteria as migrations em uma etapa controlada do deploy e não dentro do handler da API.

### Fluxo via CLI da Vercel

Se preferir publicar por CLI:

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_UNPOOLED production
vercel env add JWT_SECRET production
vercel env add MASTER_SETUP_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add ASSET_MAX_UPLOAD_BYTES production
vercel deploy
vercel --prod
```

Depois rode a migration apontando para o banco de produção com a `DATABASE_URL` correta no seu ambiente local.

## Próximo passo recomendado

Para este repositório, o caminho mais direto agora é:

1. Instalar Neon pelo Marketplace da Vercel.
2. Garantir que `DATABASE_URL` e `DATABASE_URL_UNPOOLED` foram criadas.
3. Fazer um novo deploy.
4. Rodar `pnpm prisma:migrate:deploy` contra o banco de produção.
5. Chamar `POST /api/auth/bootstrap` uma vez para criar o master.

### Primeiro acesso em produção

Após o deploy e as migrations:

1. chame `POST /api/auth/bootstrap`
2. crie o usuário `MASTER`
3. use esse usuário para cadastrar os demais admins

## Endpoints principais

### Saúde

- `GET /api/health`

### Autenticação

- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Usuários

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id/status`

### Conteúdo

- `GET /api/content/public` é público.
- Todas as rotas em `/api/content/admin` exigem autenticação com perfil `MASTER` ou `ADMIN`.
- `GET /api/content/public`
- `GET /api/content/admin`
- `POST /api/content/admin/publish`
- `GET|POST|PUT|DELETE /api/content/admin/hero-section`
- `GET /api/content/admin/scenery-section`
- `GET|POST|PUT|DELETE /api/content/admin/operation-section`
- `DELETE /api/content/admin/operation-section/images/:imageIndex`
- `GET|POST|PUT|DELETE /api/content/admin/company-information`
- `GET|POST /api/content/admin/nps`
- `GET|PUT|DELETE /api/content/admin/nps/:itemId`
- `GET|POST /api/content/admin/services-pages`
- `GET|PUT|DELETE /api/content/admin/services-pages/:slug`
- `GET|POST /api/content/admin/representants-base`
- `GET|PUT|DELETE /api/content/admin/representants-base/:itemId`
- `GET|POST /api/content/admin/categories`
- `GET|PUT|DELETE /api/content/admin/categories/:itemId`

### Respostas de NPS

- `GET /api/nps/responses`
- `POST /api/nps/responses`
- `GET /api/nps/admin/responses`
- `GET /api/nps/admin/responses/:id`
- `PATCH /api/nps/admin/responses/:id/moderation`
- `DELETE /api/nps/admin/responses/:id`

### Depoimentos

- `GET /api/testimonials`
- `POST /api/testimonials`
- `GET /api/testimonials/admin`
- `GET /api/testimonials/admin/stats`
- `GET /api/testimonials/admin/:id`
- `PATCH /api/testimonials/admin/:id/moderation`
- `DELETE /api/testimonials/admin/:id`

## Exemplo de bootstrap do master

```bash
curl -X POST http://localhost:3001/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Master User",
    "email": "master@tessa.com",
    "password": "12345678",
    "setupKey": "change-me"
  }'
```

## Modelo de conteúdo

O conteúdo principal da landing é tratado como um recurso único interno. A API gera um `id` interno para itens de `nps`, `representantsBase` e `categories`, enquanto `servicesPages` usa `slug` como identificador da rota. A `scenerySection` é derivada da lista de `servicesPages`, então não possui CRUD próprio.

As configurações de NPS da landing continuam em `content.nps`, mas as respostas enviadas pelos visitantes agora vivem no recurso separado `NpsResponse`. O fluxo é: visitante envia a resposta em `POST /api/nps/responses`, ela entra como `pending`, um admin revisa em `/api/nps/admin/responses/:id/moderation` e a landing pública recebe apenas as aprovadas no campo `content.npsResponses`.

Depoimentos seguem um fluxo parecido no recurso `Testimonial`, mas com nota de `1` a `5`, foto de perfil opcional e foto da avaliação opcional. O visitante envia em `POST /api/testimonials` (JSON para depoimentos sem foto ou `multipart/form-data` quando houver imagens), o registro entra como `pending`, um admin modera em `PATCH /api/testimonials/admin/:id/moderation` e a listagem pública em `GET /api/testimonials` retorna apenas os aprovados. O endpoint público de envio tem rate limit (`10` depoimentos por IP a cada `60` minutos) e aceita arquivos `profileImage` e `reviewImage` seguindo a mesma regra dos demais uploads: JPG, PNG ou WebP convertidos para WebP via `sharp` e armazenados no Vercel Blob.

As `servicesPages` precisam referenciar uma categoria existente em `categories`. A API normaliza e salva o `slug` canônico da categoria no campo `category`.

A seção `heroSection` aceita uma lista com `1` a `3` tópicos, e cada tópico segue a mesma estrutura de `title`, `description`, `image` e `button`.

A `operationSection` aceita um array `images` com `1` a `20` fotos. Cada arquivo enviado por multipart precisa ter menos de `3 MB`. Se alguma foto ultrapassar esse limite, a API responde com erro informando o campo exato, como `image_7`, e o motivo.

A rota `DELETE /api/content/admin/operation-section/images/:imageIndex` remove apenas a imagem selecionada (por índice), atualiza os metadados da seção e também limpa o arquivo correspondente no Blob.

As `servicesPages` aceitam `backgroundImageUrl` e um array `images` com `1` a `15` fotos por serviço.

As rotas `POST` e `PUT` de `heroSection` aceitam:

- `application/json`, quando as imagens já estiverem como URL final
- `multipart/form-data`, com um campo `payload` contendo o JSON dos tópicos e arquivos opcionais `image_0`, `image_1` e `image_2`

As rotas `POST` e `PUT` de `servicesPages` aceitam:

- `application/json`, quando `backgroundImageUrl` e `images[].imgUrl` já estiverem com as URLs finais
- `multipart/form-data`, com um campo `payload` contendo o JSON estrutural, um arquivo opcional `backgroundImage` e arquivos opcionais `image_0` até `image_14`

No `multipart/form-data`, o campo `images` pode ser omitido no `payload` quando todas as fotos vierem como arquivo no mesmo request. Em edições parciais, `images` pode ser enviado para preservar URLs já existentes em slots específicos. O `backgroundImageUrl` também pode ser omitido no `payload` quando a imagem vier no campo de arquivo `backgroundImage`.

As rotas `POST` e `PUT` de `operationSection` aceitam:

- `application/json`, quando `images[].url` já estiver com as URLs finais
- `multipart/form-data`, com arquivos opcionais `image_0` até `image_19` e um campo opcional `payload` para preservar URLs já existentes em slots específicos

No `multipart/form-data`, o `payload` pode ser omitido quando todas as fotos vierem como arquivo no mesmo request. Em edições parciais, `payload.images` pode ser enviado para preservar URLs já existentes em slots específicos, sem precisar usar objetos vazios para os uploads novos.

Uploads de imagem do admin usam Vercel Blob para o binário e Postgres para os metadados. A diretriz completa está em [docs/asset-upload-guideline.md](/home/luisfaf/tessa/tessa-api/docs/asset-upload-guideline.md).

Isso mantém a edição do painel simples para a landing principal, enquanto `servicesPages` continua como a única parte com múltiplas páginas dentro da estrutura de conteúdo.
