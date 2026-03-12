# Tessa API

API de gerenciamento de conteúdo para a landing page SSR da Tessa, preparada para deploy na Vercel.

## Stack

- Hono para rotas HTTP leves e compatíveis com Vercel Functions
- Prisma com PostgreSQL
- JWT para autenticação
- Perfis `MASTER` e `ADMIN`

## Fluxo inicial

1. Configure as variáveis de ambiente com base no arquivo `.env.example`.
2. Instale as dependências.
3. Gere o cliente Prisma.
4. Rode as migrations.
5. Faça o bootstrap do usuário master.

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/tessa?schema=public"
JWT_SECRET="change-me"
MASTER_SETUP_KEY="change-me"
```

## Scripts

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
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
