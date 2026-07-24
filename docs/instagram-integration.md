# Integração de conteúdo do Instagram

A integração usa a Instagram API com Facebook Login for Business para importar
mídias próprias e colaborações aceitas da conta profissional oficial. ADMIN e
MASTER escolhem três publicações em posições nomeadas; a seleção entra no
rascunho global e só aparece na landing após a publicação desse conteúdo.

As imagens usam as URLs temporárias da CDN da Meta. O sistema não copia os
binários para o Vercel Blob.

## Pré-requisitos

1. Conta Instagram Business ou Creator ligada à Página oficial no Facebook.
2. App Meta com Facebook Login for Business.
3. Permissões `instagram_basic`, `pages_read_engagement` e `pages_show_list`.
4. OpenAI configurada para traduzir legendas para inglês e espanhol.
5. Autorização da Meta concluída antes de habilitar a integração em produção.

## Variáveis de ambiente

```env
INSTAGRAM_APP_ID="..."
INSTAGRAM_APP_SECRET="..."
INSTAGRAM_REDIRECT_URI="https://<api-host>/api/instagram/oauth/callback"
INSTAGRAM_FACEBOOK_PAGE_ID="..." # obrigatório se houver mais de uma Página elegível
INSTAGRAM_TOKEN_ENCRYPTION_KEY="chave-com-pelo-menos-32-caracteres"
INSTAGRAM_CONTENT_ENABLED="false"
ADMIN_APP_URL="https://<admin-host>"
CRON_SECRET="..."
```

Cadastre `INSTAGRAM_REDIRECT_URI` exatamente em **Facebook Login for Business →
Valid OAuth Redirect URIs**. Essa URL não é um webhook.

Nunca registre tokens em arquivos versionados. Revogue imediatamente qualquer
token que já tenha sido exposto no histórico do repositório.

## Webhooks

Webhooks não são necessários para o catálogo e a curadoria atuais. A atualização
ocorre por sincronização manual e cron. Portanto, não configure Callback URL nem
Verify Token no produto Webhooks. Eles só serão necessários se a aplicação
passar a consumir comentários, mensagens ou eventos em tempo real.

## Fluxo operacional

1. Em **Conteúdo → Instagram**, conecte a Página oficial pelo Facebook.
2. Sincronize mídias próprias e `collaborative_media`.
3. Organize três mídias distintas em Principal, Superior direita e Inferior direita.
4. Salve o rascunho da seleção.
5. Aguarde as traduções e use a publicação global do conteúdo.
6. Ative `INSTAGRAM_CONTENT_ENABLED=true` somente no ambiente autorizado.

O cron `/api/internal/instagram/sync` atualiza o catálogo e renova as URLs da
CDN. Token expirado exige reconexão.

## Endpoints

- Público: `GET /api/instagram?limit=3&locale=en|es`
- Admin: `GET /api/instagram/admin/status`
- Admin: `GET /api/instagram/admin/catalog`
- Admin: `PUT /api/instagram/admin/selection`
- Admin: `GET /api/instagram/admin/oauth/start`
- Admin: `POST /api/instagram/admin/sync`
- MASTER: `DELETE /api/instagram/admin/connection`
- OAuth: `GET /api/instagram/oauth/callback`
- Interno: `GET|POST /api/internal/instagram/sync`

Se uma mídia publicada ficar indisponível, a leitura pública tenta substituí-la
pela candidata localizada mais recente. Sem três mídias seguras, a seção mostra
o estado vazio.
