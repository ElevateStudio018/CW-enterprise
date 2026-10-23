# Local tests for the admin backend

Against a local Supabase (Docker):

```sh
supabase start
node supabase/tests/mock-services.mjs &        # stands in for Resend, GitHub and Anthropic
supabase functions serve --env-file supabase/functions/.env.local &
supabase db reset                              # a fresh database with the original content
eval "$(supabase status -o env)"               # API_URL, ANON_KEY, SERVICE_ROLE_KEY for the tests
node supabase/tests/db.test.mjs
supabase db reset && node supabase/tests/functions.test.mjs
npx tsx supabase/tests/changeset.test.ts       # the AI's change sets: applying, checking and pricing (no database)
```

The AI tests script the model's answers through the mock (`POST /__ai` with a list of answers), so they run without an
Anthropic key; the mock streams them like the Messages API.

`supabase/functions/.env.example` lists the settings the functions read. In a sandbox whose TLS proxy the Edge
Runtime does not trust, run `node supabase/tests/npm-mirror.mjs` and set
`NPM_CONFIG_REGISTRY=http://host.docker.internal:4873/` for the functions.
