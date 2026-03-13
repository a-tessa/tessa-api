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
JWT_SECRET="change-me-min-16-chars"
MASTER_SETUP_KEY="change-me-min-8"
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
```

## Publicar na Vercel

Forma mais simples:

1. Suba este projeto para um repositório Git.
2. Crie um banco PostgreSQL gerenciado para produção.
3. Importe o repositório na Vercel.
4. Configure as variáveis de ambiente de produção.
5. Faça o deploy.
6. Rode as migrations no banco de produção.

### Variáveis de ambiente na Vercel

Cadastre estas variáveis no projeto:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/tessa_prod?schema=public"
JWT_SECRET="uma-chave-bem-grande-e-segura"
MASTER_SETUP_KEY="uma-chave-secreta-para-bootstrap"
```

Importante:

- não use a `DATABASE_URL` local do Docker na Vercel
- a Vercel não vai hospedar seu Postgres local
- o Docker deste projeto é apenas para desenvolvimento

### Build na Vercel

O projeto já está preparado para deploy porque:

- [vercel.json](/home/luisfaf/tessa/tessa-api/vercel.json) define a function `api/[[...route]].ts`
- [api/[[...route]].ts](/home/luisfaf/tessa/tessa-api/api/[[...route]].ts) exporta os handlers HTTP para a Vercel
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

### Fluxo via CLI da Vercel

Se preferir publicar por CLI:

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add MASTER_SETUP_KEY production
vercel deploy
vercel --prod
```

Depois rode a migration apontando para o banco de produção com a `DATABASE_URL` correta no seu ambiente local.

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

- `GET /api/content/public/pages/:slug`
- `GET /api/content/admin/pages`
- `GET /api/content/admin/pages/:slug`
- `PUT /api/content/admin/pages/:slug`
- `POST /api/content/admin/pages/:slug/publish`

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

Cada `LandingPage` possui:

- `slug`
- metadados SEO
- `draftContent` em JSON
- `publishedContent` em JSON
- status de rascunho/publicado

Isso facilita a leitura pública da versão publicada pela landing SSR e a edição segura da versão draft no painel administrativo.
