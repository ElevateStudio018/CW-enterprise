# Koppla in adminpanelen

Det mesta är gjort: Supabase-projektet `cw-enterprise` finns, databasen och Edge Functions är inlagda,
inloggningsinställningarna är satta och hemsidan byggs mot projektet. Under testperioden går alla mejl till
elevate.studio018@gmail.com, som också är den enda adressen som kan bli admin.

## Det här gör du

### 1. Skapa din inloggning (2 minuter)

Supabase → projektet **cw-enterprise** → Authentication → Users → **Add user** → **Create new user**:

- E-post: **elevate.studio018@gmail.com**
- Lösenord: låt din lösenordshanterare skapa ett (minst 12 tecken med stora och små bokstäver, siffror och tecken).
  Skicka det aldrig i chatten.
- Bocka i **Auto Confirm User**.

Logga sedan in på https://elevatestudio018.github.io/CW-enterprise/admin/

### 2. Senare: tre nycklar, när du vill

Lägg in dem i Supabase → cw-enterprise → **Edge Functions** → **Secrets** → **Add new secret**. Samma nycklar som i
Västkust-projektet fungerar, men GitHub-nyckeln måste ha tillgång till repot `CW-enterprise`.

| Namn | Vad den gör | Var du skapar den |
| --- | --- | --- |
| `GITHUB_DISPATCH_TOKEN` | Hemsidan uppdateras när du trycker Publicera. | GitHub → Settings → Developer settings → Fine-grained tokens. Repository access: `CW-enterprise`. Permissions → Actions: Read and write. |
| `RESEND_API_KEY` | Mejl om förfrågningar och förslag. | resend.com → API Keys. |
| `ANTHROPIC_API_KEY` | AI-assistenten. | console.anthropic.com → API keys (med betalkort under Billing). |

### Vid lansering

- CW Enterprise (info@cwenterprise.se) läggs till som admin.
- Secret `QUOTE_NOTIFY_EMAIL` = `info@cwenterprise.se`, så att förfrågningarna går dit.
- Egen domän: `EMAIL_FROM`, `SITE_URL`, `ADMIN_URL` och `ALLOWED_ORIGINS` (se `supabase/functions/.env.example`).

## För Claude: lägga in backend igen

Migreringarna i `supabase/migrations/` läggs in i filnamnsordning. Edge Functions paketeras med
`node scripts/bundle-functions.mjs` och driftsätts med `verify_jwt = false` (funktionerna kontrollerar anroparen
själva). Auth: Site URL `https://elevatestudio018.github.io/CW-enterprise/admin/`, redirect
`https://elevatestudio018.github.io/CW-enterprise/admin/**`, inga egna registreringar, lösenord minst 12 tecken med
alla teckentyper. Be aldrig användaren klistra in nycklar eller lösenord i chatten.
