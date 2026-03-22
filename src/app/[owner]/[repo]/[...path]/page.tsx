import { notFound } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getFile, getRepoTree } from "@/lib/github-client";
import DocPageClient from "./DocPageClient";

interface Props {
  params: Promise<{ owner: string; repo: string; path: string[] }>;
}

export default async function DocPage({ params }: Props) {
  const { owner, repo, path: pathSegments } = await params;
  const basePath = pathSegments.join("/");

  const token = await getToken().catch(() => null);
  if (!token) notFound();

  // Determine the default branch
  let branch = "main";
  try {
    const tree = await getRepoTree(token, owner, repo);
    void tree; // used only to trigger default-branch resolution inside getRepoTree
  } catch {
    // fall back to "main"
  }

  const candidates = [
    `${basePath}.md`,
    `${basePath}/_index.md`,
    basePath,
  ];

  let fileContent: string | null = null;
  let fileSha: string | null = null;
  let resolvedPath: string | null = null;

  for (const candidate of candidates) {
    try {
      const file = await getFile(token, owner, repo, candidate);
      fileContent = file.content;
      fileSha = file.sha;
      resolvedPath = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!fileContent || !resolvedPath || !fileSha) notFound();

  return (
    <DocPageClient
      content={fileContent}
      sha={fileSha}
      owner={owner}
      repo={repo}
      branch={branch}
      filePath={resolvedPath}
      pathSegments={pathSegments}
    />
  );
}
