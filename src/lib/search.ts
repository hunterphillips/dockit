import MiniSearch from "minisearch";
import { markdownToPlainText, extractTitle } from "./markdown";

export interface SearchDoc {
  id: string;    // file path
  title: string;
  content: string;
  path: string;
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet: string;
  score: number;
}

export function createIndex(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ["title", "content"],
    storeFields: ["title", "path", "content"],
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

export function buildSearchIndex(
  files: { path: string; content: string }[]
): MiniSearch<SearchDoc> {
  const index = createIndex();
  const docs: SearchDoc[] = files.map(({ path, content }) => ({
    id: path,
    title: extractTitle(content, path.split("/").pop() ?? path),
    content: markdownToPlainText(content),
    path,
  }));
  index.addAll(docs);
  return index;
}

export function searchIndex(
  index: MiniSearch<SearchDoc>,
  query: string
): SearchResult[] {
  if (!query.trim()) return [];

  const raw = index.search(query, { combineWith: "OR" });

  return raw.slice(0, 8).map((r) => {
    const content = (r.content as string) ?? "";
    const snippet = extractSnippet(content, query);
    return {
      id: r.id as string,
      title: (r.title as string) ?? r.id,
      path: (r.path as string) ?? r.id,
      snippet,
      score: r.score,
    };
  });
}

function extractSnippet(text: string, query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const lower = text.toLowerCase();
  let bestIdx = 0;
  for (const word of words) {
    const idx = lower.indexOf(word);
    if (idx !== -1) { bestIdx = idx; break; }
  }
  const start = Math.max(0, bestIdx - 60);
  const end = Math.min(text.length, bestIdx + 140);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}
