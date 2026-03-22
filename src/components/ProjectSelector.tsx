"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Repo } from "@/lib/github-client";
import styles from "./ProjectSelector.module.css";

export default function ProjectSelector() {
  const router = useRouter();
  const [repos, setRepos] = useState<(Repo & { hasDocsFolder?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then(async (repoList: Repo[]) => {
        // Check which repos have a docs/ folder via the tree API
        const withDocs = await Promise.all(
          repoList.map(async (r) => {
            try {
              const tree = await fetch(
                `/api/github/tree?owner=${r.owner}&repo=${r.name}`
              ).then((res) => res.json()) as { path: string }[];
              const hasDocsFolder = Array.isArray(tree) && tree.some((n) => n.path?.startsWith("docs/"));
              return { ...r, hasDocsFolder };
            } catch {
              return { ...r, hasDocsFolder: false };
            }
          })
        );
        setRepos(withDocs);
      })
      .finally(() => setLoading(false));
  }, []);

  const initDocs = async (repo: Repo) => {
    const key = `${repo.owner}/${repo.name}`;
    setInitializing(key);
    try {
      const res = await fetch("/api/github/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner, repo: repo.name }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        alert(`Failed to initialize: ${error}`);
        return;
      }
      router.push(`/${repo.owner}/${repo.name}`);
    } finally {
      setInitializing(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.wordmark}>Dockit</h1>
        <p className={styles.tagline}>Choose a repository to open or initialize documentation.</p>
      </div>

      {loading && <p className={styles.empty}>Loading repositories…</p>}

      {!loading && repos.length === 0 && (
        <p className={styles.empty}>No repositories found.</p>
      )}

      <div className={styles.grid}>
        {repos.map((repo) => {
          const key = `${repo.owner}/${repo.name}`;
          const isInitializing = initializing === key;

          return (
            <div key={key} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  <span className={styles.cardOwner}>{repo.owner}</span>
                  <h2 className={styles.cardName}>{repo.name}</h2>
                  {repo.description && (
                    <p className={styles.cardDesc}>{repo.description}</p>
                  )}
                </div>
                {repo.private && <span className={styles.privateBadge}>Private</span>}
              </div>

              <div className={styles.cardFooter}>
                {repo.hasDocsFolder ? (
                  <>
                    <span className={styles.docsBadge}>Docs initialized</span>
                    <button
                      className={styles.openBtn}
                      onClick={() => router.push(`/${repo.owner}/${repo.name}`)}
                    >
                      Open →
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.initBtn}
                    onClick={() => initDocs(repo)}
                    disabled={isInitializing}
                  >
                    {isInitializing ? "Initializing…" : "Initialize Docs"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
