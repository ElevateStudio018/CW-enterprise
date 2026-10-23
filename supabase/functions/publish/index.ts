// Publishes the draft: checks it against the content schema, makes it the new published version, reads it back to
// make sure it landed as written, and starts the rebuild of the public site. {action: "redeploy"} only restarts the
// rebuild of what is already published.
import { handle, json, readJson, UserError } from "../_shared/http.ts";
import { audit, requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { triggerDeploy } from "../_shared/deploy.ts";
import { sameDocument, validateSite } from "../_shared/validate.ts";
import { summarize } from "../_shared/site/changes.ts";

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const { user, client } = await requireAdmin(request);
    const body = await readJson<{ action?: string }>(request);

    if (body.action === "redeploy") {
      const { data, error } = await client.from("site_snapshot").select("version").eq("id", 1).single();
      if (error) throw error;
      return json(request, { status: "redeploy", version: data.version, deploy: await triggerDeploy(data.version) });
    }

    const { data: current, error: draftError } = await client.rpc("content_draft");
    if (draftError) throw draftError;
    if (current.changes === 0 && !current.themeChanged) {
      throw new UserError(409, "nothing_to_publish", "Det finns inga ändringar att publicera.");
    }

    const checked = validateSite(current.draft);
    if (!checked.ok) {
      return json(request, { error: "invalid_content", message: "Några fält behöver rättas innan du kan publicera.", issues: checked.issues }, 422);
    }

    const { data: rows, error: rowsError } = await client.from("website_content").select("path");
    if (rowsError) throw rowsError;
    const summary = summarize(current.draft, (rows ?? []).map((row: { path: string[] }) => row.path), current.themeChanged ? ["Färger och typsnitt"] : []);

    const { data: result, error: publishError } = await client.rpc("publish_draft", { p_marker: current.marker, p_summary: summary });
    if (publishError) throw publishError;
    if (result.status === "changed") {
      throw new UserError(409, "changed", "Något ändrades precis medan du publicerade. Försök igen.");
    }

    // Read it back: what is published must be exactly what was checked. If not, write it once more and note it.
    const service = serviceClient();
    const { data: published } = await service.from("site_snapshot").select("version, data").eq("id", 1).single();
    if (!published || published.version !== result.version || !sameDocument(published.data, current.draft)) {
      await service.from("site_snapshot").update({ data: current.draft }).eq("id", 1).eq("version", result.version);
      await audit("content.publish_repaired", `version ${result.version}`, published?.data ?? null, current.draft, user.id);
    }

    const deploy = await triggerDeploy(result.version);
    return json(request, { status: "published", version: result.version, revisionId: result.revisionId, summary, deploy });
  })
);
