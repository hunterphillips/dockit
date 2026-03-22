// Strip YAML frontmatter and return { data, content }
export function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) data[key] = value;
  }

  return { data, content: match[2] };
}

// Compute GitHub raw content base URL for a file's directory
export function rawBaseUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  const dir = filePath.split("/").slice(0, -1).join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dir}`;
}

// Resolve relative image src values to absolute GitHub raw URLs.
// Called by the DocViewer image component.
export function resolveImageSrc(
  src: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  if (!src) return src;
  // Already absolute
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  // Resolve relative path against the file's directory
  const dir = filePath.split("/").slice(0, -1);
  const parts = src.split("/");
  const resolved = [...dir];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolved.join("/")}`;
}

// Strip markdown syntax to extract plain text for search indexing
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\n?/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, "")    // code blocks
    .replace(/`[^`]*`/g, "")           // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "")   // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links → label
    .replace(/#{1,6}\s+/g, "")         // headings
    .replace(/[*_~]{1,3}/g, "")        // bold/italic/strikethrough
    .replace(/^\s*[-*+]\s+/gm, "")     // list bullets
    .replace(/^\s*\d+\.\s+/gm, "")     // ordered list
    .replace(/\|/g, " ")               // table pipes
    .replace(/\s+/g, " ")
    .trim();
}

// Extract the first h1 title from markdown, falling back to filename
export function extractTitle(markdown: string, filename: string): string {
  const { content } = parseFrontmatter(markdown);
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return filename.replace(/\.md$/, "").replace(/-/g, " ");
}
