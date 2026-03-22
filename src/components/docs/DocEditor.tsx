"use client";

import { useEffect, useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { parseFrontmatter } from "@/lib/markdown";
import { uploadAsset } from "@/lib/assets";
import styles from "./DocEditor.module.css";

interface DocEditorProps {
  owner: string;
  repo: string;
  filePath: string;
  initialContent: string;
  sha: string;
  onSave: (newContent: string, newSha: string) => void;
  onCancel: () => void;
}

export default function DocEditor({
  owner,
  repo,
  filePath,
  initialContent,
  sha,
  onSave,
  onCancel,
}: DocEditorProps) {
  const { data: frontmatter } = parseFrontmatter(initialContent);
  const hasFrontmatter = Object.keys(frontmatter).length > 0;

  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      const relPath = await uploadAsset(file, owner, repo, filePath);
      // BlockNote expects a URL; we return the relative path which the viewer resolves
      return relPath;
    },
  });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [commitMessage, setCommitMessage] = useState(
    `Update ${filePath.split("/").pop()}`
  );
  const [showMessageInput, setShowMessageInput] = useState(false);

  // Load initial content into the editor
  useEffect(() => {
    async function load() {
      const { content } = parseFrontmatter(initialContent);
      const blocks = await editor.tryParseMarkdownToBlocks(content);
      editor.replaceBlocks(editor.document, blocks);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setConflict(false);
    try {
      const bodyMarkdown = await editor.blocksToMarkdownLossy(editor.document);

      // Re-attach frontmatter if the original file had it
      let fullContent = bodyMarkdown;
      if (hasFrontmatter) {
        const fmLines = Object.entries(frontmatter)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        fullContent = `---\n${fmLines}\n---\n\n${bodyMarkdown}`;
      }

      const res = await fetch("/api/github/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          path: filePath,
          content: fullContent,
          sha,
          message: commitMessage,
        }),
      });

      if (res.status === 409) {
        setConflict(true);
        return;
      }

      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        alert(`Save failed: ${error}`);
        return;
      }

      const { sha: newSha } = await res.json() as { sha: string };
      onSave(fullContent, newSha);
    } finally {
      setSaving(false);
    }
  }, [editor, owner, repo, filePath, sha, commitMessage, hasFrontmatter, frontmatter, onSave]);

  return (
    <div className={styles.wrapper}>
      {conflict && (
        <div className={styles.conflictBanner}>
          <span>This file was updated by someone else. Reload to see the latest version before saving.</span>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.editingLabel}>Editing</span>
          {showMessageInput ? (
            <input
              className={styles.commitInput}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              autoFocus
            />
          ) : (
            <button
              className={styles.messageToggle}
              onClick={() => setShowMessageInput(true)}
              title="Edit commit message"
            >
              {commitMessage}
            </button>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className={styles.editorWrap}>
        <BlockNoteView
          editor={editor}
          theme="light"
          className={styles.blockNote}
        />
      </div>
    </div>
  );
}
