import { getFile, getRepoTree } from "@/lib/github-client";

const MAX_CONTEXT_CHARS = 150_000;

/**
 * Assembles a doc context string from all markdown files in the repo.
 * Prioritizes the currently viewed doc, then truncates if total is too large.
 */
export async function assembleDocContext(
  token: string,
  owner: string,
  repo: string,
  currentFilePath?: string
): Promise<string> {
  const tree = await getRepoTree(token, owner, repo);
  const mdPaths = tree
    .filter(
      (n) =>
        n.type === "blob" &&
        n.path.endsWith(".md") &&
        !n.path.startsWith("docs/.meta/")
    )
    .map((n) => n.path);

  // Prioritize the current doc
  const sorted = currentFilePath
    ? [currentFilePath, ...mdPaths.filter((p) => p !== currentFilePath)]
    : mdPaths;

  const fileResults = await Promise.allSettled(
    sorted.map((p) =>
      getFile(token, owner, repo, p).then((f) => ({ path: p, content: f.content }))
    )
  );

  const parts: string[] = [];
  let totalChars = 0;

  for (const result of fileResults) {
    if (result.status !== "fulfilled") continue;
    const { path, content } = result.value;
    const section = `## ${path}\n\n${content}\n\n---\n\n`;
    if (totalChars + section.length > MAX_CONTEXT_CHARS) {
      parts.push("*[Additional documents omitted due to context length.]*\n\n");
      break;
    }
    parts.push(section);
    totalChars += section.length;
  }

  return parts.join("");
}
