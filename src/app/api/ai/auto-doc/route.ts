import { NextRequest } from "next/server";
import { getToken } from "@/lib/auth";
import { getFile, putFile } from "@/lib/github-client";
import { parseConfig } from "@/lib/taxonomy";
import { runAutoDocAgent } from "@/lib/auto-doc-agent";

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    owner: string;
    repo: string;
    filePath: string;
    sha: string;
  };
  const { owner, repo, filePath, sha } = body;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => controller.enqueue(sseEvent(data));

      try {
        const token = await getToken();

        const { content: configContent } = await getFile(
          token,
          owner,
          repo,
          "docs/.meta/config.json"
        );
        const config = parseConfig(configContent);

        if (!config.linkedRepo) {
          enqueue({ type: "error", message: "No source repo linked" });
          controller.close();
          return;
        }

        const { owner: sourceOwner, repo: sourceRepo } = config.linkedRepo;
        const { content: existingContent } = await getFile(token, owner, repo, filePath);

        enqueue({ type: "status", message: "Starting agent..." });

        const generatedContent = await runAutoDocAgent({
          token,
          sourceOwner,
          sourceRepo,
          docFilePath: filePath,
          existingContent,
          onProgress: (message) => enqueue({ type: "status", message }),
        });

        enqueue({ type: "status", message: "Committing..." });

        const filename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
        const title = filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        const { sha: newSha } = await putFile(
          token,
          owner,
          repo,
          filePath,
          generatedContent,
          sha,
          `Auto-document: ${title}`
        );

        enqueue({ type: "done", sha: newSha, content: generatedContent });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        enqueue({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
