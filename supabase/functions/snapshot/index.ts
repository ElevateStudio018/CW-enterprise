// The published content as one document, for anything that reads it over the web. Cached by version: a client that
// already has the current version gets an empty 304.
import { handle, json, corsHeaders } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(
  handle(async (request) => {
    const { data, error } = await serviceClient().from("site_snapshot").select("version, data, published_at").eq("id", 1).single();
    if (error) throw error;
    const etag = `"v${data.version}"`;
    const caching = { ETag: etag, "Cache-Control": "public, max-age=0, must-revalidate" };
    // Compressing proxies turn the tag into a weak one (W/"v3"); either way it names the same version.
    const known = (request.headers.get("If-None-Match") ?? "").split(",").map((tag) => tag.trim().replace(/^W\//, ""));
    if (known.includes(etag)) {
      return new Response(null, { status: 304, headers: { ...corsHeaders(request), ...caching } });
    }
    return json(request, { version: data.version, publishedAt: data.published_at, data: data.data }, 200, caching);
  })
);
