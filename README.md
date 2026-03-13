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
