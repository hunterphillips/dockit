"use client";

import { useState, useCallback } from "react";
import styles from "./RawEditor.module.css";

interface RawEditorProps {
  owner: string;
  repo: string;
  filePath: string;
  initialContent: string;
  sha: string;
  onSave: (newContent: string, newSha: string) => void;
  onCancel: () => void;
}

export default function RawEditor({
  owner,
  repo,
  filePath,
  initialContent,
  sha,
  onSave,
  onCancel,
}: RawEditorProps) {
  const [value, setValue] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [commitMessage, setCommitMessage] = useState(
    `Update ${filePath.split("/").pop()}`
  );
  const [showMessageInput, setShowMessageInput] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setConflict(false);
    try {
      const res = await fetch("/api/github/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          path: filePath,
          content: value,
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
      onSave(value, newSha);
    } finally {
      setSaving(false);
    }
  }, [owner, repo, filePath, value, sha, commitMessage, onSave]);

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
          <span className={styles.editingLabel}>Markdown</span>
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

      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}
