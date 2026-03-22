import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { getRepoTree } from "@/lib/github-client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  try {
    const token = await getToken();
    const tree = await getRepoTree(token, owner, repo);

    // Filter out .meta/ internals from the response — hidden from the UI tree
    const filtered = tree.filter((node) => !node.path.startsWith("docs/.meta/"));

    return NextResponse.json(filtered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
