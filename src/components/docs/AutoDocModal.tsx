"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./AutoDocModal.module.css";

interface TreeNode {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

interface TreeItem {
  name: string;
  path: string;
  type: "blob" | "tree";
  children: TreeItem[];
}

function buildTree(nodes: TreeNode[]): TreeItem[] {
  const root: TreeItem[] = [];

  for (const node of nodes) {
    const parts = node.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;

      let existing = current.find((item) => item.name === name);
      if (!existing) {
        existing = {
          name,
          path,
          type: isLast ? node.type : "tree",
          children: [],
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  return root;
}

function getAllBlobPaths(item: TreeItem): string[] {
  if (item.type === "blob") return [item.path];
  return item.children.flatMap(getAllBlobPaths);
}

interface Props {
  sourceOwner: string;
  sourceRepo: string;
  docTitle: string;
  onStart: (selectedPaths: string[]) => void;
  onCancel: () => void;
}

export default function AutoDocModal({
  sourceOwner,
  sourceRepo,
  docTitle,
  onStart,
  onCancel,
}: Props) {
  const [tree, setTree] = useState<TreeItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/github/tree?owner=${sourceOwner}&repo=${sourceRepo}`)
      .then((r) => r.json())
      .then((nodes: TreeNode[]) => {
        const t = buildTree(nodes);
        const topExpanded = new Set<string>();
        for (const item of t) {
          if (item.type === "tree") topExpanded.add(item.path);
        }
        setExpanded(topExpanded);
        setTree(t);
      })
      .catch(() => setLoadError(true));
  }, [sourceOwner, sourceRepo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelect = useCallback((item: TreeItem) => {
    const blobs = getAllBlobPaths(item);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = blobs.every((p) => next.has(p));
      if (allSelected) {
        for (const p of blobs) next.delete(p);
      } else {
        for (const p of blobs) next.add(p);
      }
      return next;
    });
  }, []);

  const isSelected = (item: TreeItem) => {
    const blobs = getAllBlobPaths(item);
    return blobs.length > 0 && blobs.every((p) => selected.has(p));
  };

  const isIndeterminate = (item: TreeItem) => {
    if (item.type === "blob") return false;
    const blobs = getAllBlobPaths(item);
    const count = blobs.filter((p) => selected.has(p)).length;
    return count > 0 && count < blobs.length;
  };

  const selectAll = () => {
    if (!tree) return;
    setSelected(new Set(tree.flatMap(getAllBlobPaths)));
  };

  const clearAll = () => setSelected(new Set());

  const renderTree = (items: TreeItem[], depth = 0): React.ReactNode => {
    return items.map((item) => (
      <div key={item.path}>
        <div
          className={styles.treeItem}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <input
            type="checkbox"
            checked={isSelected(item)}
            onChange={() => toggleSelect(item)}
            ref={(el) => {
              if (el) el.indeterminate = isIndeterminate(item);
            }}
          />
          {item.type === "tree" ? (
            <>
              <button
                className={styles.expandBtn}
                onClick={() => toggleExpand(item.path)}
                aria-label={expanded.has(item.path) ? "Collapse" : "Expand"}
              >
                {expanded.has(item.path) ? "▾" : "▸"}
              </button>
              <span
                className={styles.folderName}
                onClick={() => toggleExpand(item.path)}
              >
                {item.name}
              </span>
            </>
          ) : (
            <span className={styles.fileName}>{item.name}</span>
          )}
        </div>
        {item.type === "tree" &&
          expanded.has(item.path) &&
          renderTree(item.children, depth + 1)}
      </div>
    ));
  };

  const selectedCount = selected.size;
  const buttonLabel =
    selectedCount === 0
      ? "Start (full exploration)"
      : `Start (${selectedCount} file${selectedCount === 1 ? "" : "s"} selected)`;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Auto-document: {docTitle}</div>
            <div className={styles.subtitle}>
              {sourceOwner}/{sourceRepo}
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.description}>
          Select files or folders to focus the agent on. Leave empty to let it
          explore the full repository.
        </div>

        <div className={styles.treeHeader}>
          <span className={styles.treeLabel}>{sourceRepo}</span>
          <div className={styles.treeActions}>
            <button className={styles.treeActionBtn} onClick={selectAll}>
              Select all
            </button>
            <button className={styles.treeActionBtn} onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>

        <div className={styles.treeContainer}>
          {tree === null && !loadError && (
            <div className={styles.loading}>Loading file tree…</div>
          )}
          {loadError && (
            <div className={styles.error}>
              Failed to load file tree. You can still start with full
              exploration.
            </div>
          )}
          {tree !== null && renderTree(tree)}
        </div>

        {selectedCount > 0 && (
          <div className={styles.selectionCount}>
            {selectedCount} file{selectedCount === 1 ? "" : "s"} selected
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.startBtn}
            onClick={() => onStart(Array.from(selected))}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
