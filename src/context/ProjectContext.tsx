"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type MiniSearch from "minisearch";
import type { TreeNode } from "@/lib/github-client";
import type { ProjectConfig } from "@/lib/taxonomy";
import { parseConfig, DEFAULT_CONFIG } from "@/lib/taxonomy";
import type { SearchDoc } from "@/lib/search";

interface ProjectContextValue {
  owner: string;
  repo: string;
  tree: TreeNode[];
  config: ProjectConfig;
  loadingTree: boolean;
  searchIndex: MiniSearch<SearchDoc> | null;
  refreshTree: () => Promise<void>;
  updateSearchEntry: (path: string, content: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  owner,
  repo,
  children,
}: {
  owner: string;
  repo: string;
  children: React.ReactNode;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [loadingTree, setLoadingTree] = useState(true);
  const [searchIndex, setSearchIndex] = useState<MiniSearch<SearchDoc> | null>(null);
  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);

  const fetchTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const [treeRes, configRes] = await Promise.allSettled([
        fetch(`/api/github/tree?owner=${owner}&repo=${repo}`).then((r) => r.json()),
        fetch(`/api/github/file?owner=${owner}&repo=${repo}&path=docs/.meta/config.json`).then(
          (r) => (r.ok ? r.json() : null)
        ),
      ]);

      let nodes: TreeNode[] = [];
      if (treeRes.status === "fulfilled") {
        nodes = treeRes.value as TreeNode[];
        setTree(nodes);
      }
      if (
        configRes.status === "fulfilled" &&
        configRes.value &&
        typeof configRes.value.content === "string"
      ) {
        setConfig(parseConfig(configRes.value.content));
      }

      // Build search index lazily — fetch all markdown files
      buildIndex(nodes, owner, repo);
    } finally {
      setLoadingTree(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const buildIndex = useCallback(
    async (nodes: TreeNode[], owner: string, repo: string) => {
      const mdNodes = nodes.filter(
        (n) =>
          n.type === "blob" &&
          n.path.endsWith(".md") &&
          !n.path.startsWith("docs/.meta/")
      );

      const files = await Promise.allSettled(
        mdNodes.map((n) =>
          fetch(`/api/github/file?owner=${owner}&repo=${repo}&path=${encodeURIComponent(n.path)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) =>
              d && typeof d.content === "string"
                ? { path: n.path, content: d.content as string }
                : null
            )
        )
      );

      const validFiles = files
        .filter((r): r is PromiseFulfilledResult<{ path: string; content: string } | null> =>
          r.status === "fulfilled" && r.value !== null
        )
        .map((r) => r.value!);

      const { buildSearchIndex } = await import("@/lib/search");
      const idx = buildSearchIndex(validFiles);
      indexRef.current = idx;
      setSearchIndex(idx);
    },
    []
  );

  const updateSearchEntry = useCallback((path: string, content: string) => {
    if (!indexRef.current) return;
    const { extractTitle, markdownToPlainText } = require("@/lib/markdown") as typeof import("@/lib/markdown");
    try { indexRef.current.discard(path); } catch { /* not in index */ }
    indexRef.current.add({
      id: path,
      title: extractTitle(content, path.split("/").pop() ?? path),
      content: markdownToPlainText(content),
      path,
    });
    setSearchIndex(indexRef.current);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        owner,
        repo,
        tree,
        config,
        loadingTree,
        searchIndex,
        refreshTree: fetchTree,
        updateSearchEntry,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
