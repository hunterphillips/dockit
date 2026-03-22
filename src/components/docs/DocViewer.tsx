"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeRaw from "rehype-raw";
import { parseFrontmatter, resolveImageSrc } from "@/lib/markdown";
import type { Components } from "react-markdown";
import styles from "./DocViewer.module.css";

interface DocViewerProps {
  content: string;
  owner: string;
  repo: string;
  branch?: string;
  filePath: string;
}

const DECISION_STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  deprecated: "Deprecated",
  superseded: "Superseded",
};

export default function DocViewer({
  content,
  owner,
  repo,
  branch = "main",
  filePath,
}: DocViewerProps) {
  const { data: frontmatter, content: body } = parseFrontmatter(content);
  const isDecision = filePath.includes("/decisions/");

  const components: Components = {
    // Resolve relative image paths to GitHub raw URLs
    img({ src, alt, ...rest }) {
      const srcStr = typeof src === "string" ? src : "";
      const resolved = srcStr
        ? resolveImageSrc(srcStr, owner, repo, branch, filePath)
        : "";
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt ?? ""} {...rest} />;
    },
  };

  return (
    <article className={styles.wrapper}>
      {/* Decision frontmatter badge */}
      {isDecision && frontmatter.status && (
        <div className={styles.decisionMeta}>
          {frontmatter.date && (
            <span className={styles.decisionDate}>{frontmatter.date}</span>
          )}
          <span
            className={`${styles.statusBadge} ${styles[`status_${frontmatter.status}`]}`}
          >
            {DECISION_STATUS_LABELS[frontmatter.status] ?? frontmatter.status}
          </span>
        </div>
      )}

      <div className="doc-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {body}
        </ReactMarkdown>
      </div>
    </article>
  );
}
