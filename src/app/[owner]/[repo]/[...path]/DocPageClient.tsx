"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import DocViewer from "@/components/docs/DocViewer";
import RawEditor from "@/components/docs/RawEditor";
import { useAIPanel } from "@/context/AIPanelContext";
import { useProject } from "@/context/ProjectContext";
import styles from "./DocPageClient.module.css";

// BlockNote uses browser APIs — load client-side only
const DocEditor = dynamic(() => import("@/components/docs/DocEditor"), {
  ssr: false,
});

interface Props {
  content: string;
  sha: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  pathSegments: string[];
}

export default function DocPageClient({
  content: initialContent,
  sha: initialSha,
  owner,
  repo,
  branch,
  filePath,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editorType, setEditorType] = useState<"wysiwyg" | "raw">("wysiwyg");
  const [content, setContent] = useState(initialContent);
  const [sha, setSha] = useState(initialSha);

  const { setDocState, onEditAppliedRef } = useAIPanel();
  const { config } = useProject();

  const [autoDocStatus, setAutoDocStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [autoDocMessage, setAutoDocMessage] = useState("");
  const autoDocAbortRef = useRef<AbortController | null>(null);

  // Register current doc state in AI panel context
  useEffect(() => {
    setDocState({ owner, repo, filePath, content, sha });
    return () => setDocState(null);
  }, [owner, repo, filePath, content, sha, setDocState]);

  // Register callback so AI panel can update our state after applying an edit
  onEditAppliedRef.current = (newContent: string, newSha: string) => {
    setContent(newContent);
    setSha(newSha);
    setMode("view");
  };

  const handleSave = (newContent: string, newSha: string) => {
    setContent(newContent);
    setSha(newSha);
    setMode("view");
  };

  async function startAutoDoc() {
    autoDocAbortRef.current = new AbortController();
    setAutoDocStatus("running");
    setAutoDocMessage("Starting…");

    try {
      const res = await fetch("/api/ai/auto-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, filePath, sha }),
        signal: autoDocAbortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setAutoDocMessage("Request failed");
        setAutoDocStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: "status" | "done" | "error";
              message?: string;
              sha?: string;
              content?: string;
            };

            if (event.type === "status") {
              setAutoDocMessage(event.message ?? "");
            } else if (event.type === "done") {
              if (event.content) setContent(event.content);
              if (event.sha) setSha(event.sha);
              setAutoDocStatus("done");
              setAutoDocMessage("Done");
              setTimeout(() => {
                setAutoDocStatus("idle");
                setAutoDocMessage("");
              }, 2000);
            } else if (event.type === "error") {
              setAutoDocMessage(event.message ?? "Unknown error");
              setAutoDocStatus("error");
            }
          } catch {
            // malformed event — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAutoDocMessage(err instanceof Error ? err.message : "Unknown error");
        setAutoDocStatus("error");
      }
    }
  }

  return (
    <>
      {mode === "view" && (
        <div className={styles.viewWrapper}>
          <div className={styles.viewToolbar}>
            {config.linkedRepo && (
              autoDocStatus === "idle" ? (
                <button className={styles.autoDocBtn} onClick={startAutoDoc}>
                  ✦ Auto-document
                </button>
              ) : (
                <span className={`${styles.autoDocStatus} ${autoDocStatus === "error" ? styles.autoDocStatusError : ""}`}>
                  {autoDocMessage}
                </span>
              )
            )}
            <button
              className={styles.editBtn}
              onClick={() => { setEditorType("wysiwyg"); setMode("edit"); }}
            >
              Edit
            </button>
            <button
              className={styles.markdownBtn}
              onClick={() => { setEditorType("raw"); setMode("edit"); }}
              title="Edit raw markdown"
            >
              Markdown
            </button>
          </div>
          <DocViewer
            content={content}
            owner={owner}
            repo={repo}
            branch={branch}
            filePath={filePath}
          />
        </div>
      )}

      {mode === "edit" && editorType === "wysiwyg" && (
        <DocEditor
          owner={owner}
          repo={repo}
          filePath={filePath}
          initialContent={content}
          sha={sha}
          onSave={handleSave}
          onCancel={() => setMode("view")}
        />
      )}

      {mode === "edit" && editorType === "raw" && (
        <RawEditor
          owner={owner}
          repo={repo}
          filePath={filePath}
          initialContent={content}
          sha={sha}
          onSave={handleSave}
          onCancel={() => setMode("view")}
        />
      )}
    </>
  );
}
