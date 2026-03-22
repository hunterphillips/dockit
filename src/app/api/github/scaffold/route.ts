import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { getRepoTree, commitFiles } from "@/lib/github-client";
import { getScaffoldFiles } from "@/lib/taxonomy";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken();
    const body = await req.json() as { owner: string; repo: string };
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
    }

    // Check if docs/ already exists
    const tree = await getRepoTree(token, owner, repo);
    const hasDocsFolder = tree.some((node) => node.path.startsWith("docs/"));
    if (hasDocsFolder) {
      return NextResponse.json(
        { error: "docs/ folder already exists in this repository" },
        { status: 409 }
      );
    }

    const files = getScaffoldFiles();
    await commitFiles(
      token,
      owner,
      repo,
      files,
      "Initialize Dockit documentation structure"
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
