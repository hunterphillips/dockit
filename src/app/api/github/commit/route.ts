import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { commitFiles, type FileChange } from "@/lib/github-client";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken();
    const body = await req.json() as {
      owner: string;
      repo: string;
      files: FileChange[];
      message: string;
      branch?: string;
    };

    const { owner, repo, files, message, branch } = body;
    if (!owner || !repo || !files?.length || !message) {
      return NextResponse.json(
        { error: "owner, repo, files, and message are required" },
        { status: 400 }
      );
    }

    const commitSha = await commitFiles(token, owner, repo, files, message, branch);
    return NextResponse.json({ commitSha });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
