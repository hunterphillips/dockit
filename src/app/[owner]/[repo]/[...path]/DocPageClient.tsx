"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import DocViewer from "@/components/docs/DocViewer";
import RawEditor from "@/components/docs/RawEditor";
import { useAIPanel } from "@/context/AIPanelContext";
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

  return (
    <>
      {mode === "view" && (
        <div className={styles.viewWrapper}>
          <div className={styles.viewToolbar}>
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
