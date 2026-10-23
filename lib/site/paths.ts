// Reading and changing the content document by path, the way the database does it (see the content migration):
// a set creates the objects on its way, a delete removes the key, and changes apply shortest path first.

export type ContentPath = string[];

export interface Patch {
  path: ContentPath;
  op: "set" | "delete";
  value?: unknown;
}

export const pathKey = (path: ContentPath) => path.join(".");

export function getAt(doc: unknown, path: ContentPath): unknown {
  let node = doc;
  for (const key of path) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** A copy of `doc` with `value` at `path`; untouched branches are shared, not copied. */
export function setAt<T>(doc: T, path: ContentPath, value: unknown): T {
  if (path.length === 0) return value as T;
  if (Array.isArray(doc)) throw new Error(`Cannot change part of a list (${pathKey(path)})`);
  const node = doc !== null && typeof doc === "object" ? (doc as Record<string, unknown>) : {};
  const [head, ...rest] = path;
  return { ...node, [head]: setAt(node[head], rest, value) } as T;
}

export function deleteAt<T>(doc: T, path: ContentPath): T {
  if (path.length === 0 || doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const node = doc as Record<string, unknown>;
  const [head, ...rest] = path;
  if (!(head in node)) return doc;
  if (rest.length === 0) {
    const { [head]: _removed, ...others } = node;
    return others as T;
  }
  return { ...node, [head]: deleteAt(node[head], rest) } as T;
}

export function applyPatch<T>(doc: T, patch: Patch): T {
  return patch.op === "delete" ? deleteAt(doc, patch.path) : setAt(doc, patch.path, patch.value);
}

/** Applies changes in the database's order: shorter paths first, then alphabetically. */
export function applyPatches<T>(doc: T, patches: Patch[]): T {
  const ordered = [...patches].sort((a, b) => a.path.length - b.path.length || pathKey(a.path).localeCompare(pathKey(b.path)));
  return ordered.reduce(applyPatch, doc);
}

export function isPrefix(prefix: ContentPath, path: ContentPath): boolean {
  return prefix.length <= path.length && prefix.every((key, index) => path[index] === key);
}
