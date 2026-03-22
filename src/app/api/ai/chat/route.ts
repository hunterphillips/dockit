import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getToken } from "@/lib/auth";
import { assembleDocContext } from "@/lib/ai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const QA_SYSTEM = (docs: string) =>
  `You are an AI assistant for the documentation of a software project.
You have access to the full documentation below. Answer questions based on this documentation. Be concise and cite specific sections when relevant.

--- DOCUMENTATION ---
${docs}
--- END DOCUMENTATION ---`;

const EDIT_SYSTEM = (docs: string) =>
  `You are an AI assistant helping edit documentation for a software project.
You have access to the full documentation below.

--- DOCUMENTATION ---
${docs}
--- END DOCUMENTATION ---

When asked to edit a document, return ONLY the full revised markdown content of that document, wrapped in a code fence:

\`\`\`markdown
[revised content here]
\`\`\`

Do not include any explanation before or after the code fence.`;

export async function POST(req: NextRequest) {
  try {
    const token = await getToken();
    const body = (await req.json()) as {
      owner: string;
      repo: string;
      messages: { role: "user" | "assistant"; content: string }[];
      mode: "qa" | "edit";
      currentDoc?: { filePath: string; content: string };
    };

    const { owner, repo, messages, mode, currentDoc } = body;

    if (!owner || !repo || !messages?.length || !mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const docContext = await assembleDocContext(token, owner, repo, currentDoc?.filePath);
    const systemPrompt = mode === "qa" ? QA_SYSTEM(docContext) : EDIT_SYSTEM(docContext);

    if (mode === "qa") {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Edit mode: return full revised content
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Extract content from markdown code fence
      const match = text.match(/```(?:markdown)?\n([\s\S]*?)```/);
      const proposed = match ? match[1] : text;

      return NextResponse.json({ proposed });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
