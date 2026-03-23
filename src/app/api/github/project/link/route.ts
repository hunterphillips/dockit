import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { getFile, putFile } from "@/lib/github-client";
import { parseConfig } from "@/lib/taxonomy";

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken();
    const body = (await req.json()) as {
      owner: string;
      repo: string;
      linkedRepo: { owner: string; repo: string } | null;
    };
    const { owner, repo, linkedRepo } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { content, sha } = await getFile(token, owner, repo, "docs/.meta/config.json");
    const config = parseConfig(content);

    if (linkedRepo === null) {
      delete config.linkedRepo;
    } else {
      config.linkedRepo = linkedRepo;
    }

    await putFile(
      token,
      owner,
      repo,
      "docs/.meta/config.json",
      JSON.stringify(config, null, 2) + "\n",
      sha,
      linkedRepo
        ? `Link source repo: ${linkedRepo.owner}/${linkedRepo.repo}`
        : "Remove linked source repo"
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
