"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { searchIndex } from "@/lib/search";
import type { SearchResult } from "@/lib/search";
import styles from "./SearchBar.module.css";

export default function SearchBar() {
  const { owner, repo, searchIndex: index } = useProject();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      if (!index || !q.trim()) {
        setResults([]);
        setOpen(false);
        return;
      }
      const res = searchIndex(index, q);
      setResults(res);
      setOpen(res.length > 0);
      setActiveIdx(0);
    },
    [index]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 150);
  };

  const navigate = (result: SearchResult) => {
    // Convert file path to URL: docs/business-logic/data-model.md → /owner/repo/docs/business-logic/data-model
    const urlPath = result.path.replace(/\.md$/, "");
    router.push(`/${owner}/${repo}/${urlPath}`);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) navigate(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest(`.${styles.wrap}`)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        placeholder="Search docs…"
        aria-label="Search documentation"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length) setOpen(true); }}
        autoComplete="off"
      />

      {open && (
        <div className={styles.dropdown} role="listbox" aria-label="Search results">
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`${styles.result} ${i === activeIdx ? styles.active : ""}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => navigate(r)}
            >
              <span className={styles.resultTitle}>{r.title}</span>
              <span className={styles.resultSnippet}>{r.snippet}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
