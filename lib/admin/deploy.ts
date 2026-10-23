"use client";

import { useEffect, useState } from "react";
import { basePath } from "./config";
import { supabase } from "./supabase";

export type DeployPhase = "idle" | "updating" | "live" | "failed" | "not_configured";

/**
 * Whether the public site has caught up with the published version: the build writes the version it was made from
 * to site-version.json, which this asks for until it matches (or ten minutes have passed).
 */
export function useDeployStatus(publishedVersion: number): { phase: DeployPhase; liveVersion: number | null } {
  const [liveVersion, setLiveVersion] = useState<number | null>(null);
  const [deployState, setDeployState] = useState<string>("idle");

  useEffect(() => {
    if (!publishedVersion) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();

    async function check() {
      try {
        const response = await fetch(`${basePath}/site-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const { version } = (await response.json()) as { version: number };
          if (!stopped) setLiveVersion(version);
          if (version >= publishedVersion) return;
        }
      } catch {
        // The file is only there on a connected build; keep asking quietly.
      }
      const { data } = await supabase().from("settings").select("value").eq("key", "deploy").maybeSingle();
      if (!stopped && data?.value?.status) setDeployState(data.value.status as string);
      if (!stopped && Date.now() - started < 10 * 60_000) timer = setTimeout(check, 8000);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [publishedVersion]);

  if (liveVersion !== null && liveVersion >= publishedVersion) return { phase: "live", liveVersion };
  if (deployState === "failed") return { phase: "failed", liveVersion };
  if (deployState === "not_configured") return { phase: "not_configured", liveVersion };
  if (deployState === "started") return { phase: "updating", liveVersion };
  return { phase: liveVersion === null ? "idle" : "updating", liveVersion };
}
