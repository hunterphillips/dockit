"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Repo } from "@/lib/github-client";
import styles from "./ProjectSelector.module.css";

export default function ProjectSelector() {
  const router = useRouter();
  const [projects, setProjects] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrivate, setFormPrivate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((data: Repo[]) => setProjects(data))
      .finally(() => setLoading(false));
  }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/github/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          private: formPrivate,
        }),
      });
      const data = await res.json() as { owner?: string; repo?: string; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create project");
        return;
      }
      router.push(`/${data.owner}/${data.repo}`);
    } catch {
      setFormError("Network error, please try again");
    } finally {
      setCreating(false);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormName("");
    setFormDesc("");
    setFormPrivate(false);
    setFormError(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.wordmark}>Dockit</h1>
            <p className={styles.tagline}>Your documentation projects.</p>
          </div>
          {!showForm && (
            <button className={styles.newProjectBtn} onClick={() => setShowForm(true)}>
              + New Project
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>New Project</h2>
          <form onSubmit={createProject} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="proj-name">
                Project name
              </label>
              <input
                id="proj-name"
                className={styles.input}
                type="text"
                placeholder="my-project-docs"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="proj-desc">
                Description <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="proj-desc"
                className={styles.input}
                type="text"
                placeholder="Documentation for…"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formPrivate}
                onChange={(e) => setFormPrivate(e.target.checked)}
              />
              <span>Private repository</span>
            </label>
            {formError && <p className={styles.formError}>{formError}</p>}
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.createBtn}
                disabled={creating || !formName.trim()}
              >
                {creating ? "Creating…" : "Create Project"}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={cancelForm}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className={styles.empty}>Loading projects…</p>}

      {!loading && projects.length === 0 && !showForm && (
        <div className={styles.emptyState}>
          <p className={styles.emptyHeading}>No projects yet.</p>
        </div>
      )}

      <div className={styles.grid}>
        {projects.map((project) => {
          const key = `${project.owner}/${project.name}`;
          return (
            <div
              key={key}
              className={styles.card}
              onClick={() => router.push(`/${project.owner}/${project.name}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && router.push(`/${project.owner}/${project.name}`)
              }
            >
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  <span className={styles.cardOwner}>{project.owner}</span>
                  <h2 className={styles.cardName}>{project.name}</h2>
                  {project.description && (
                    <p className={styles.cardDesc}>{project.description}</p>
                  )}
                </div>
                {project.private && <span className={styles.privateBadge}>Private</span>}
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.openLink}>Open →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
