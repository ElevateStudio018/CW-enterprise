// Local test helper for sandboxes whose TLS proxy the Edge Runtime does not trust: serves the npm registry over plain
// HTTP (fetched by Node, which does trust it) and rewrites tarball addresses to point back here. Set
// NPM_CONFIG_REGISTRY=http://host.docker.internal:4873/ for the functions. Run: node supabase/tests/npm-mirror.mjs
import http from "node:http";

const port = Number(process.env.MIRROR_PORT ?? 4873);
const upstream = "https://registry.npmjs.org";
const self = process.env.MIRROR_SELF ?? `http://host.docker.internal:${port}`;

http
  .createServer(async (req, res) => {
    try {
      const response = await fetch(upstream + req.url, { headers: { accept: req.headers.accept ?? "application/json" } });
      const type = response.headers.get("content-type") ?? "application/octet-stream";
      if (type.includes("json")) {
        const text = (await response.text()).replaceAll(upstream, self);
        res.writeHead(response.status, { "content-type": type });
        res.end(text);
      } else {
        res.writeHead(response.status, { "content-type": type });
        res.end(Buffer.from(await response.arrayBuffer()));
      }
    } catch (error) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(String(error));
    }
  })
  .listen(port, "0.0.0.0", () => console.log(`npm mirror on ${port}`));
