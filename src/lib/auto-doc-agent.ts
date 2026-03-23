import Anthropic from "@anthropic-ai/sdk";
import { getRepoTree, getFile } from "./github-client";

const MAX_READ_FILES = 15;

interface AgentOptions {
  token: string;
  sourceOwner: string;
  sourceRepo: string;
  docFilePath: string;
  existingContent: string;
  onProgress: (message: string) => void;
}

function deriveTitle(filePath: string): string {
  const filename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
  return filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const tools: Anthropic.Tool[] = [
  {
    name: "list_repo_tree",
    description:
      "List all files in the source repository. Returns file paths as a newline-separated list.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read the content of a file from the source repository.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
      },
      required: ["path"],
    },
  },
];

export async function runAutoDocAgent(options: AgentOptions): Promise<string> {
  const { token, sourceOwner, sourceRepo, docFilePath, existingContent, onProgress } = options;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const title = deriveTitle(docFilePath);
  let readFileCount = 0;

  const systemPrompt = `You are a documentation writer. Your task is to write the "${title}" section of a software documentation project by exploring the source code repository.

Current doc content (may be empty or a skeleton):
${existingContent || "(empty)"}

Source repository: ${sourceOwner}/${sourceRepo}

Instructions:
- Use list_repo_tree to understand the repository structure
- Use read_file selectively to read the most relevant files for this documentation section
- Focus on the "${title}" topic specifically
- Be thorough but concise

Your final response MUST be raw markdown only — no preamble, no explanation, no meta-commentary. Start directly with the first heading or paragraph of the documentation. Do not write sentences like "Here is the documentation" or "I have gathered everything I need." Output only the content that will be saved to the file.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Please explore the source repository and write comprehensive documentation for the "${title}" section. Read the source code and write accurate, detailed documentation based on what you find.`,
    },
  ];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    // Process tool_use blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      let result: string;

      if (block.name === "list_repo_tree") {
        onProgress("Exploring repository structure...");
        try {
          const tree = await getRepoTree(token, sourceOwner, sourceRepo);
          const paths = tree
            .filter((n) => n.type === "blob")
            .map((n) => n.path)
            .slice(0, 500)
            .join("\n");
          result = paths || "(empty repository)";
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : "Failed to list tree"}`;
        }
      } else if (block.name === "read_file") {
        const input = block.input as { path: string };
        if (readFileCount >= MAX_READ_FILES) {
          result = "Error: Maximum file read limit (15) reached";
        } else {
          readFileCount++;
          onProgress(`Reading ${input.path}...`);
          try {
            const file = await getFile(token, sourceOwner, sourceRepo, input.path);
            result = file.content.slice(0, 6000);
            if (file.content.length > 6000) {
              result += "\n\n[Content truncated at 6000 chars]";
            }
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : "Failed to read file"}`;
          }
        }
      } else {
        result = "Unknown tool";
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
}
