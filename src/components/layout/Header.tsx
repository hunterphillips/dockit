"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import SearchBar from "./SearchBar";
import { useAIPanel } from "@/context/AIPanelContext";
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
