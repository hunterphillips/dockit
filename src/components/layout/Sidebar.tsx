"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { getDisplayName } from "@/lib/taxonomy";
import styles from "./Sidebar.module.css";

interface TreeSection {
  segment: string;
  label: string;
  icon: string;
  children: TreeItem[];
}

interface TreeItem {
  label: string;
  href: string;
  path: string;
}

const SECTION_ICONS: Record<string, string> = {
  "business-logic": "⊞",
  integrations: "⇄",
  "roles-and-access": "◎",
  decisions: "◈",
};

function buildTree(
  owner: string,
  repo: string,
  nodes: { path: string; type: string }[],
  config: { displayNames?: Record<string, string>; icons?: Record<string, string> }
): { topLevel: TreeItem[]; sections: TreeSection[] } {
  // Only look at docs/ paths, excluding .meta/
  const docNodes = nodes.filter(
    (n) =>
      n.path.startsWith("docs/") &&
      !n.path.startsWith("docs/.meta/") &&
      n.type === "blob" &&
      n.path.endsWith(".md")
  );

  const topLevel: TreeItem[] = [];
  const sectionMap = new Map<string, TreeItem[]>();

  for (const node of docNodes) {
    // Strip leading docs/
    const rel = node.path.replace(/^docs\//, "");
    const parts = rel.split("/");

    if (parts.length === 1) {
      // Top-level file (e.g., overview.md, glossary.md)
      const name = parts[0].replace(/\.md$/, "");
      topLevel.push({
        label: getDisplayName(name, config as Parameters<typeof getDisplayName>[1]),
        href: `/${owner}/${repo}/docs/${name}`,
        path: node.path,
      });
    } else {
      // Sectioned file (e.g., business-logic/data-model.md)
      const section = parts[0];
      const filename = parts[parts.length - 1].replace(/\.md$/, "");

      // Skip _index files — they are section landing pages, not sidebar items
      if (filename === "_index") continue;

      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      const pathWithoutExt = node.path.replace(/\.md$/, "");
      sectionMap.get(section)!.push({
        label: getDisplayName(filename, config as Parameters<typeof getDisplayName>[1]),
        href: `/${owner}/${repo}/${pathWithoutExt}`,
        path: node.path,
      });
    }
  }

  const sections: TreeSection[] = Array.from(sectionMap.entries()).map(
    ([segment, children]) => ({
      segment,
      label: getDisplayName(segment, config as Parameters<typeof getDisplayName>[1]),
      icon: config.icons?.[segment] ? "" : (SECTION_ICONS[segment] ?? "◦"),
      children,
    })
  );

  return { topLevel, sections };
}

interface SidebarProps {
  owner: string;
  repo: string;
}

export default function Sidebar({ owner, repo }: SidebarProps) {
  const { tree, config, loadingTree } = useProject();
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`sidebar-open-${owner}-${repo}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set(["business-logic", "integrations", "roles-and-access", "decisions"]);
    } catch {
      return new Set(["business-logic", "integrations", "roles-and-access", "decisions"]);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        `sidebar-open-${owner}-${repo}`,
        JSON.stringify([...openSections])
      );
    } catch {
      // ignore
    }
  }, [openSections, owner, repo]);

  const toggleSection = (segment: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(segment)) next.delete(segment);
      else next.add(segment);
      return next;
    });
  };

  const { topLevel, sections } = buildTree(owner, repo, tree, config);

  return (
    <nav className={styles.sidebar} aria-label="Documentation tree">
      <div className={styles.projectLabel}>
        <span className={styles.projectName}>{repo}</span>
        <span className={styles.projectOwner}>{owner}</span>
      </div>

      {loadingTree && (
        <span className={styles.loading}>Loading…</span>
      )}

      {/* Top-level files (overview, glossary) */}
      {topLevel.map((item) => (
        <Link
          key={item.path}
          href={item.href}
          className={`${styles.treeItem} ${pathname === item.href ? styles.active : ""}`}
        >
          {item.label}
        </Link>
      ))}

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.segment} className={styles.treeSection}>
          <button
            className={styles.treeSectionHeader}
            onClick={() => toggleSection(section.segment)}
            aria-expanded={openSections.has(section.segment)}
          >
            <span className={`${styles.chevron} ${openSections.has(section.segment) ? styles.open : ""}`}>
              ▶
            </span>
            <span>{section.label}</span>
          </button>

          {openSections.has(section.segment) && (
            <div className={styles.treeChildren}>
              {/* Section landing page link */}
              <Link
                href={`/${owner}/${repo}/docs/${section.segment}`}
                className={`${styles.treeItem} ${styles.sectionIndex} ${
                  pathname === `/${owner}/${repo}/docs/${section.segment}` ? styles.active : ""
                }`}
              >
                Overview
              </Link>

              {section.children.map((item) => (
                <Link
                  key={item.path}
                  href={item.href}
                  className={`${styles.treeItem} ${pathname === item.href ? styles.active : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
