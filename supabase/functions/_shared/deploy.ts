// Starts the GitHub Actions workflow that builds the public site from the published snapshot and puts it online.
import { env, optionalEnv } from "./env.ts";
import { serviceClient } from "./supabase.ts";

export interface DeployResult {
  started: boolean;
  message?: string;
}

export async function triggerDeploy(version: number): Promise<DeployResult> {
  const token = optionalEnv("GITHUB_DISPATCH_TOKEN");
  const service = serviceClient();
  const record = (value: Record<string, unknown>) =>
    service.from("settings").upsert({ key: "deploy", value: { ...value, version, at: new Date().toISOString() }, updated_at: new Date().toISOString() });

  if (!token) {
    await record({ status: "not_configured" });
    return { started: false, message: "Uppdateringen av hemsidan är inte kopplad än (GITHUB_DISPATCH_TOKEN saknas)." };
  }

  const repository = env("GITHUB_REPOSITORY", "ElevateStudio018/CW-enterprise");
  const workflow = env("GITHUB_WORKFLOW", "deploy-pages.yml");
  const ref = env("GITHUB_REF", "claude/ny-webbplats");
  const api = env("GITHUB_API_URL", "https://api.github.com");

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${api}/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "cw-enterprise-admin",
        },
        body: JSON.stringify({ ref }),
      });
      if (response.status === 204) {
        await record({ status: "started" });
        return { started: true };
      }
      console.error("GitHub refused the deploy:", response.status, await response.text());
      if (response.status < 500) break;
    } catch (error) {
      console.error("Could not reach GitHub:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  await record({ status: "failed" });
  return { started: false, message: "Ändringen är sparad, men hemsidan kunde inte uppdateras just nu. Försök igen om en stund." };
}
