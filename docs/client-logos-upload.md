# Clients (Logos) — Upload e Rotas

## Resumo

Coleção `clients` dentro de `LandingPage.draftContent` / `publishedContent` (landing principal, slug `home`). Cada item guarda metadados do cliente + URL pública do logo armazenado no Vercel Blob.

Participa do fluxo draft/publish padrão: uploads alteram o `draftContent`. O conteúdo público só muda após `POST /api/content/admin/publish`.

## Estrutura do item

```ts
{
  id: string         // uuid gerado pelo backend, usado apenas no draft
  name: string       // nome da empresa/cliente
  alt: string        // texto alternativo do logo (acessibilidade)
  website?: string   // URL do site do cliente (opcional)
  logoUrl: string    // URL pública do blob (sempre .webp lossless)
}
```

No `publishedContent` o `id` é removido (publish é snapshot limpo, mesma regra de `nps`/`categories`/`representantsBase`).

## Rotas

### Pública (consumo pelo frontend)

`GET /api/content/public/clients`

Retorna apenas clientes do `publishedContent`. Sem autenticação.

```json
{
  "clients": [
    { "id": "...", "name": "Acme", "alt": "Logo Acme", "website": "https://acme.com", "logoUrl": "https://...blob.vercel-storage.com/landing-page/home/clients/<id>/<timestamp>-acme.webp" }
  ]
}
```

Lê direto do `LandingPage.publishedContent.clients`. Retorna `[]` se não houver conteúdo publicado.

### Admin (gerenciamento)

Todas exigem `Authorization: Bearer <token>` com role `MASTER` ou `ADMIN`.

- `GET /api/content/admin/clients` — lista do draft
- `GET /api/content/admin/clients/:clientId` — item do draft
- `POST /api/content/admin/clients` — cria cliente (requer upload de logo)
- `PUT /api/content/admin/clients/:clientId` — atualiza cliente (logo opcional)
- `DELETE /api/content/admin/clients/:clientId` — remove cliente e apaga blob

## Formato do request

### POST (criação)

Obrigatoriamente `multipart/form-data`. Campo `logo` é obrigatório.

Campos aceitos em multipart:

| Campo      | Tipo   | Obrigatório | Observação                                            |
| ---------- | ------ | :---------: | ----------------------------------------------------- |
| `logo`     | File   |     sim     | PNG, máx `700 KB`                                     |
| `payload`  | string |      -      | JSON com `{ name, alt, website? }`; opcional         |
| `name`     | string |      *      | alternativa ao `payload` (quando `payload` ausente)   |
| `alt`      | string |      *      | alternativa ao `payload`                              |
| `website`  | string |      -      | alternativa ao `payload`                              |

`*` `name` e `alt` são sempre obrigatórios — via `payload` ou via campos soltos.

### PUT (atualização)

Aceita `multipart/form-data` **ou** `application/json`.

- No multipart, `logo` é opcional. Se não enviado, mantém o logo atual.
- Em JSON, aceita `{ name, alt, website?, logoUrl? }`. Se `logoUrl` ausente, mantém o atual.

### DELETE

Sem body. Remove o item do draft e apaga o blob do Vercel.

## Regras de validação

- `logo` precisa ser PNG real (magic bytes `89 50 4E 47 0D 0A 1A 0A`). Extensão/MIME não basta.
- Tamanho máximo do arquivo: `700 KB` (`CLIENT_LOGO_MAX_BYTES = 700 * 1024`).
- `name`: 1–120 caracteres, trim.
- `alt`: 1–255 caracteres, trim.
- `website`: URL válida, opcional.
- Conversão: `sharp(...).rotate().webp({ lossless: true, effort: 6 })`. Preserva transparência e nitidez do texto; arquivo final costuma ficar menor que o PNG original.

## Pathname no Blob

`landing-page/home/clients/<clientId>/<ISO-timestamp>-<slug-do-nome-original>.webp`

Pathname único por upload. Ao trocar o logo num PUT, o blob antigo é deletado depois do sucesso da transação.

## Persistência

- Binário: Vercel Blob (`access: "public"`).
- Metadados: tabela `Asset` com
  - `kind`: `image`
  - `entityType`: `landingPage`
  - `entityId`: `home`
  - `sectionKey`: `clients`
  - `fieldKey`: `logoUrl`
  - `slot`: `null` (identificação é por URL, não por posição)
- Conteúdo: `draftContent.clients[]` no `LandingPage` com `slug = "home"`.

## Ordem segura (POST/PUT)

1. Validar body e logo (magic bytes + limite).
2. Converter PNG → webp lossless.
3. Upload no Blob.
4. Em transação: atualizar `draftContent` + criar/atualizar `Asset`.
5. Se transação falhar: deletar blob recém-criado (best-effort).
6. Em PUT com logo novo: depois da transação, deletar o blob anterior (best-effort).

## Segurança

- Upload (`POST`/`PUT`/`DELETE`): autenticação admin obrigatória.
- Consulta (`GET /public/clients`): pública, serve só o publicado.
- Validação de PNG por magic bytes protege contra uploads com extensão falsa.
- Limite rígido de `700 KB` protege memória da função serverless.

## Variáveis de ambiente

Mesmas do fluxo geral de assets:

- `BLOB_READ_WRITE_TOKEN`
- `ASSET_MAX_UPLOAD_BYTES` (usado por outras rotas; `clients` tem limite próprio em código)
