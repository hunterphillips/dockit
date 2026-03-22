"use client";

import { useState } from "react";
import { diffLines } from "diff";
import { useProject } from "@/context/ProjectContext";
import styles from "./DiffPreview.module.css";

interface Props {
  owner: string;
  repo: string;
  filePath: string;
  original: string;
  proposed: string;
  sha: string;
  userRequest: string;
  onApplied: (newContent: string, newSha: string) => void;
  onDiscard: () => void;
}

export default function DiffPreview({
  owner,
  repo,
  filePath,
  original,
  proposed,
  sha,
  userRequest,
  onApplied,
  onDiscard,
}: Props) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateSearchEntry } = useProject();

  const changes = diffLines(original, proposed);
  const hasChanges = changes.some((c) => c.added || c.removed);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const commitMsg = `AI-suggested edit: ${userRequest.slice(0, 72)}`;
      const res = await fetch("/api/github/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          path: filePath,
          content: proposed,
          sha,
          message: commitMsg,
        }),
      });

      if (res.status === 409) {
        setError("Conflict: file was modified externally. Reload to get the latest version.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save");
        return;
      }

      const { sha: newSha } = (await res.json()) as { sha: string };
      updateSearchEntry(filePath, proposed);
      onApplied(proposed, newSha);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.title}>
          {hasChanges ? "Proposed changes" : "No changes"}
        </span>
        <div className={styles.actions}>
          <button
            className={styles.discardBtn}
            onClick={onDiscard}
            disabled={applying}
          >
            Discard
          </button>
          {hasChanges && (
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? "Applying…" : "Apply & Commit"}
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.diffView}>
        {changes.map((change, i) => {
          const rawLines = change.value.split("\n");
          // Remove trailing empty string from trailing newline
          const lines =
            rawLines[rawLines.length - 1] === ""
              ? rawLines.slice(0, -1)
              : rawLines;

          if (!change.added && !change.removed) {
            if (lines.length <= 4) {
              return lines.map((line, j) => (
                <div key={`${i}-${j}`} className={styles.lineContext}>
                  <span className={styles.lineGutter}> </span>
                  <span className={styles.lineContent}>{line}</span>
                </div>
              ));
            }
            return (
              <div key={i}>
                {lines.slice(0, 2).map((line, j) => (
                  <div key={`top-${j}`} className={styles.lineContext}>
                    <span className={styles.lineGutter}> </span>
                    <span className={styles.lineContent}>{line}</span>
                  </div>
                ))}
                <div className={styles.hunkDivider}>
                  ··· {lines.length - 4} unchanged lines ···
                </div>
                {lines.slice(-2).map((line, j) => (
                  <div key={`bot-${j}`} className={styles.lineContext}>
                    <span className={styles.lineGutter}> </span>
                    <span className={styles.lineContent}>{line}</span>
                  </div>
                ))}
              </div>
            );
          }

          const lineClass = change.added ? styles.lineAdded : styles.lineRemoved;
          const gutter = change.added ? "+" : "−";
          return lines.map((line, j) => (
            <div key={`${i}-${j}`} className={lineClass}>
              <span className={styles.lineGutter}>{gutter}</span>
              <span className={styles.lineContent}>{line}</span>
            </div>
          ));
        })}
      </div>
    </div>
  );
}
