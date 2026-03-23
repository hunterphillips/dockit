"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import SearchBar from "./SearchBar";
import { useAIPanel } from "@/context/AIPanelContext";
import { useProject } from "@/context/ProjectContext";
import styles from "./Header.module.css";

interface HeaderProps {
  owner: string;
  repo: string;
  currentPath?: string[];
}

export default function Header({ owner, repo, currentPath = [] }: HeaderProps) {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { open: aiOpen, toggle: toggleAI } = useAIPanel();
  const { config, refreshTree } = useProject();

  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const linkPopoverRef = useRef<HTMLDivElement>(null);

  const linked = config.linkedRepo ?? null;

  // Close popover on outside click
  useEffect(() => {
    if (!linkPanelOpen) return;
    function handleClick(e: MouseEvent) {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
        setLinkPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [linkPanelOpen]);

  function parseRepoInput(input: string): { owner: string; repo: string } | null {
    const trimmed = input.trim().replace(/\.git$/, "");
    // https://github.com/owner/repo or github.com/owner/repo
    const urlMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
    // owner/repo shorthand
    const parts = trimmed.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
    return null;
  }

  async function saveLink() {
    const parsed = parseRepoInput(linkInput);
    if (!parsed) return;
    setSaving(true);
    try {
      await fetch("/api/github/project/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          linkedRepo: parsed,
        }),
      });
      await refreshTree();
      setLinkInput("");
      setLinkPanelOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch("/api/github/project/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, linkedRepo: null }),
      });
      await refreshTree();
      setLinkPanelOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: repo, href: `/${owner}/${repo}` },
    ...currentPath.map((segment, i) => ({
      label: segment
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\.md$/, ""),
      href: `/${owner}/${repo}/${currentPath.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className={styles.breadcrumbItem}>
            {i > 0 && <span className={styles.breadcrumbSep}>/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className={styles.breadcrumbLink}>
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <SearchBar />

      {/* Source repo link dot */}
      <div className={styles.linkWrap} ref={linkPopoverRef}>
        <button
          className={`${styles.linkBtn} ${linked ? styles.linkBtnActive : ""}`}
          onClick={() => {
            setLinkPanelOpen((p) => !p);
            if (!linked) setLinkInput("");
          }}
          aria-label={linked ? `Linked to ${linked.owner}/${linked.repo}` : "Link source repo"}
          title={linked ? `Linked: ${linked.owner}/${linked.repo}` : "Link source repo"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        {linkPanelOpen && (
          <div className={styles.linkPopover}>
            {linked ? (
              <>
                <p className={styles.linkPopoverLabel}>Linked source repo</p>
                <p className={styles.linkPopoverRepo}>{linked.owner}/{linked.repo}</p>
                <div className={styles.linkPopoverActions}>
                  <button
                    className={styles.linkPopoverBtn}
                    onClick={disconnect}
                    disabled={saving}
                  >
                    {saving ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.linkPopoverLabel}>Link source repo</p>
                <input
                  className={styles.linkPopoverInput}
                  placeholder="https://github.com/owner/repo"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveLink()}
                  autoFocus
                />
                <div className={styles.linkPopoverActions}>
                  <button
                    className={styles.linkPopoverBtnPrimary}
                    onClick={saveLink}
                    disabled={saving || !parseRepoInput(linkInput)}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* AI panel toggle */}
      <button
        className={`${styles.aiBtn} ${aiOpen ? styles.aiBtnActive : ""}`}
        onClick={toggleAI}
        aria-label="Toggle AI assistant"
        aria-expanded={aiOpen}
      >
        ✦ AI
      </button>

      {/* User menu */}
      <div className={styles.userMenu}>
        <button
          className={styles.avatarBtn}
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
        >
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User"}
              className={styles.avatar}
            />
          ) : (
            <span className={styles.avatarFallback}>
              {session?.user?.name?.[0] ?? "?"}
            </span>
          )}
        </button>

        {userMenuOpen && (
          <>
            <div
              className={styles.menuBackdrop}
              onClick={() => setUserMenuOpen(false)}
            />
            <div className={styles.dropdown} role="menu">
              <div className={styles.dropdownUser}>
                <span className={styles.dropdownName}>{session?.user?.name}</span>
                <span className={styles.dropdownEmail}>{session?.user?.email}</span>
              </div>
              <hr className={styles.dropdownDivider} />
              <Link
                href="/"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                Switch project
              </Link>
              <button
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
