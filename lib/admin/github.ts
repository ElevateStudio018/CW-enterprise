// The admin's only backend: this site's GitHub repository. The site is built from content/site.json, so publishing is
// a commit of that file (plus content/version.json, which the build turns into site-version.json for the "is it live
// yet" check); the push rebuilds the site (.github/workflows/deploy-pages.yml). Signing in means giving a GitHub token
// that may write to this repository's contents; it is kept in this browser only.

/** owner/name and branch of the repository the site is built from (set at build time from the GitHub Actions run). */
export const repository = process.env.NEXT_PUBLIC_CONTENT_REPOSITORY || "";
export const branch = process.env.NEXT_PUBLIC_CONTENT_BRANCH || "";
export const CONTENT_PATH = "content/site.json";
export const VERSION_PATH = "content/version.json";
export const UPLOADS_DIR = "public/photos/uploads";

const API = "https://api.github.com";
const TOKEN_KEY = `site-admin-token:${repository}`;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the token lasts as long as the tab.
  }
}

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function swedish(status: number, fallback: string): string {
  if (status === 401) return "Inloggningsnyckeln fungerar inte längre. Logga in igen.";
  if (status === 403) return "Nyckeln får inte ändra hemsidan, eller så har GitHub tillfälligt stoppat för många anrop.";
  if (status === 404) return "Hittade inte hemsidans innehåll. Kontrollera att nyckeln gäller rätt hemsida.";
  if (status === 409) return "Någon annan publicerade samtidigt. Ladda om och försök igen.";
  return fallback;
}

export async function gh<T = any>(path: string, init: RequestInit = {}, token = getToken()): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new GitHubError("Ingen kontakt med GitHub. Kontrollera internetanslutningen.", 0);
  }
  if (!response.ok) throw new GitHubError(swedish(response.status, "Något gick fel hos GitHub. Försök igen."), response.status);
  return (response.status === 204 ? null : await response.json()) as T;
}

const repoPath = () => `/repos/${repository}`;

/** Checks a token: it must reach this repository and be allowed to push to it. Returns the account's name. */
export async function verifyToken(token: string): Promise<string> {
  const repo = await gh<{ permissions?: { push?: boolean } }>(repoPath(), {}, token).catch((error) => {
    if (error instanceof GitHubError && (error.status === 401 || error.status === 404))
      throw new GitHubError("Nyckeln stämmer inte. Kontrollera att du klistrat in hela nyckeln.", error.status);
    throw error;
  });
  // A public repository answers without a valid key too, but then without permissions.
  if (!repo.permissions) throw new GitHubError("Nyckeln stämmer inte. Kontrollera att du klistrat in hela nyckeln.", 401);
  if (!repo.permissions.push) throw new GitHubError("Nyckeln får läsa men inte ändra hemsidan.", 403);
  try {
    const user = await gh<{ login: string; name: string | null }>("/user", {}, token);
    return user.name || user.login;
  } catch {
    // Fine-grained tokens without account access cannot read /user; the repository check is what counts.
    return "Admin";
  }
}

function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A text file on the branch with its blob sha, or null when it does not exist. */
export async function readFile(path: string, ref?: string): Promise<{ text: string; sha: string } | null> {
  // Read at the branch's newest commit, not by branch name: a commit never changes, so no cached copy can be stale.
  ref ??= await headSha();
  try {
    const file = await gh<{ content: string; sha: string; encoding: string }>(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    return { text: decodeBase64(file.content), sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Commits several files at once on the branch (one commit, one rebuild). Text files are given as strings, binary files
 * as base64. Fails with 409 if the branch moved past `expectedHead` (someone else committed meanwhile).
 */
export async function commitFiles(
  files: { path: string; text?: string; base64?: string }[],
  message: string,
  expectedHead?: string
): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(`${repoPath()}/git/ref/heads/${encodeURIComponent(branch)}`);
  const head = ref.object.sha;
  if (expectedHead && expectedHead !== head) throw new GitHubError(swedish(409, ""), 409);
  const commit = await gh<{ tree: { sha: string } }>(`${repoPath()}/git/commits/${head}`);
  const tree = await Promise.all(
    files.map(async (file) => {
      const blob = await gh<{ sha: string }>(`${repoPath()}/git/blobs`, {
        method: "POST",
        body: JSON.stringify(file.base64 !== undefined ? { content: file.base64, encoding: "base64" } : { content: encodeBase64(file.text ?? ""), encoding: "base64" }),
      });
      return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
    })
  );
  const newTree = await gh<{ sha: string }>(`${repoPath()}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
  const newCommit = await gh<{ sha: string }>(`${repoPath()}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }),
  });
  await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });
  return newCommit.sha;
}

/** The newest commit on the branch (to know whether someone else published in between). */
export async function headSha(): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(`${repoPath()}/git/ref/heads/${encodeURIComponent(branch)}`);
  return ref.object.sha;
}

export interface ContentCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

/** The commits that changed the content, newest first. */
export async function contentHistory(limit = 30): Promise<ContentCommit[]> {
  const commits = await gh<{ sha: string; commit: { message: string; author: { date: string; name: string } } }[]>(
    `${repoPath()}/commits?sha=${encodeURIComponent(branch)}&path=${CONTENT_PATH}&per_page=${limit}`
  );
  return commits.map((c) => ({ sha: c.sha, message: c.commit.message.split("\n")[0], date: c.commit.author.date, author: c.commit.author.name }));
}

/** The files in a folder of the repository (empty when it does not exist yet). */
export async function listFolder(path: string): Promise<{ name: string; path: string; sha: string; size: number }[]> {
  try {
    return await gh(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(await headSha())}`);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

/** Removes files in one commit. */
export async function deleteFiles(paths: string[], message: string): Promise<void> {
  const ref = await gh<{ object: { sha: string } }>(`${repoPath()}/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await gh<{ tree: { sha: string } }>(`${repoPath()}/git/commits/${ref.object.sha}`);
  const tree = paths.map((path) => ({ path, mode: "100644", type: "blob", sha: null }));
  const newTree = await gh<{ sha: string }>(`${repoPath()}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
  const newCommit = await gh<{ sha: string }>(`${repoPath()}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
  await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });
}
