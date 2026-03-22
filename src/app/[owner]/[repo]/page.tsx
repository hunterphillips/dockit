import { getToken } from "@/lib/auth";
import { getFile } from "@/lib/github-client";
import DocPageClient from "./[...path]/DocPageClient";
import styles from "./overview.module.css";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function ProjectOverviewPage({ params }: Props) {
  const { owner, repo } = await params;

  try {
    const token = await getToken();
    const file = await getFile(token, owner, repo, "docs/overview.md");

    return (
      <DocPageClient
        content={file.content}
        sha={file.sha}
        owner={owner}
        repo={repo}
        branch="main"
        filePath="docs/overview.md"
        pathSegments={[]}
      />
    );
  } catch {
    return (
      <div className={styles.empty}>
        <h2>No overview yet</h2>
        <p>Initialize docs or create a <code>docs/overview.md</code> file in this repository.</p>
      </div>
    );
  }
}
