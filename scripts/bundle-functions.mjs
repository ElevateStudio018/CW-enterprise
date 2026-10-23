// Bundles every Edge Function in supabase/functions into one self-contained file (supabase/bundles/<name>.js), with
// the npm packages from the import map left as npm: specifiers for Deno to fetch. Used to deploy the functions through
// the Supabase Management API when the Supabase CLI is not at hand.
import { build } from "esbuild";
import { readdirSync, readFileSync, statSync } from "node:fs";

const imports = JSON.parse(readFileSync("supabase/functions/deno.json", "utf8")).imports;
const importMap = {
  name: "import-map",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (imports[args.path]) return { path: imports[args.path], external: true };
      if (/^(npm|jsr|https?|node):/.test(args.path)) return { path: args.path, external: true };
      return undefined;
    });
  },
};

const names = readdirSync("supabase/functions").filter((n) => n !== "_shared" && statSync(`supabase/functions/${n}`).isDirectory());
for (const name of names) {
  await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    outfile: `supabase/bundles/${name}.js`,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [importMap],
    logLevel: "warning",
  });
  console.log(name, Math.round(statSync(`supabase/bundles/${name}.js`).size / 1024), "KB");
}
