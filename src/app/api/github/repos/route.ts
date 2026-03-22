import { NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { listRepos } from "@/lib/github-client";

export async function GET() {
  try {
    const token = await getToken();
    const repos = await listRepos(token);
    return NextResponse.json(repos);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
