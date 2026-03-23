import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { createRepo, addDocKitTopic, commitFiles } from "@/lib/github-client";
import { getScaffoldFiles } from "@/lib/taxonomy";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken();
    const body = await req.json() as { name: string; description?: string; private?: boolean };
    const { name, description = "", private: isPrivate = false } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Create a new dedicated GitHub repo
    const { owner, name: repoName, defaultBranch } = await createRepo(
      token,
      name,
      description,
      isPrivate
    );

    // Tag it so Dockit recognizes it as a project
    await addDocKitTopic(token, owner, repoName);

    // Scaffold the docs structure
    const files = getScaffoldFiles();
    await commitFiles(
      token,
      owner,
      repoName,
      files,
      "Initialize Dockit documentation structure",
      defaultBranch
    );

    return NextResponse.json({ owner, repo: repoName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
