import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { getFile, putFile, getOctokit } from "@/lib/github-client";

// Variant of putFile that accepts pre-encoded base64 content (for binary assets)
async function putFileRaw(
  token: string,
  owner: string,
  repo: string,
  path: string,
  base64Content: string,
  sha: string | undefined,
  message: string
): Promise<{ sha: string; commitSha: string }> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner, repo, path, message,
    content: base64Content,
    ...(sha ? { sha } : {}),
  });
  return {
    sha: (data.content as { sha: string }).sha,
    commitSha: data.commit.sha ?? "",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");

  if (!owner || !repo || !path) {
    return NextResponse.json({ error: "owner, repo, and path are required" }, { status: 400 });
  }

  try {
    const token = await getToken();
    const file = await getFile(token, owner, repo, path);
    return NextResponse.json(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg.includes("Not Found")) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken();
    const body = await req.json() as {
      owner: string;
      repo: string;
      path: string;
      content: string;
      sha?: string;
      message?: string;
      rawBase64?: boolean; // if true, content is already base64-encoded (for binary assets)
    };

    const { owner, repo, path, content, sha, message, rawBase64 } = body;
    if (!owner || !repo || !path || content === undefined) {
      return NextResponse.json({ error: "owner, repo, path, and content are required" }, { status: 400 });
    }
    if (!path.startsWith("docs/")) {
      return NextResponse.json({ error: "Writes are restricted to the docs/ directory" }, { status: 400 });
    }

    const commitMessage = message ?? `Update ${path.split("/").pop()}`;
    // For binary assets, bypass the UTF-8 encode step in putFile
    const result = rawBase64
      ? await putFileRaw(token, owner, repo, path, content, sha, commitMessage)
      : await putFile(token, owner, repo, path, content, sha, commitMessage);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // GitHub returns 409 on SHA conflict
    if (msg.includes("409") || msg.includes("conflict")) {
      return NextResponse.json({ error: "Conflict: file was modified by someone else" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
