import { Octokit } from "@octokit/rest";

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

export interface TreeNode {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

export interface FileContent {
  content: string;
  sha: string;
  encoding: "base64" | "utf-8";
}

export interface FileChange {
  path: string;
  content: string;
}

export interface Repo {
  owner: string;
  name: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
}

export async function listRepos(token: string): Promise<Repo[]> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
  });
  return data
    .filter((r) => r.topics?.includes("dockit"))
    .map((r) => ({
      owner: r.owner.login,
      name: r.name,
      description: r.description,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<{ owner: string; name: string; defaultBranch: string }> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: true,
  });
  return {
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
  };
}

export async function addDocKitTopic(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const octokit = getOctokit(token);
  await octokit.repos.replaceAllTopics({ owner, repo, names: ["dockit"] });
}

export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<TreeNode[]> {
  const octokit = getOctokit(token);

  // Get default branch if not provided
  let ref = branch;
  if (!ref) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    ref = repoData.default_branch;
  }

  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: "1",
  });

  return (data.tree as TreeNode[]).filter(
    (node) => node.path && node.type && node.sha
  );
}

export async function getFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<FileContent> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ...(ref ? { ref } : {}),
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path "${path}" is not a file`);
  }

  // GitHub returns base64-encoded content
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha, encoding: "utf-8" };
}

export async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string | undefined,
  message: string
): Promise<{ sha: string; commitSha: string }> {
  const octokit = getOctokit(token);
  const encoded = Buffer.from(content, "utf-8").toString("base64");

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encoded,
    ...(sha ? { sha } : {}),
  });

  return {
    sha: (data.content as { sha: string }).sha,
    commitSha: data.commit.sha ?? "",
  };
}

// Commit multiple files atomically via the Git Data API
export async function commitFiles(
  token: string,
  owner: string,
  repo: string,
  files: FileChange[],
  message: string,
  branch?: string
): Promise<string> {
  const octokit = getOctokit(token);

  // Get default branch if needed
  let ref = branch;
  if (!ref) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    ref = repoData.default_branch;
  }

  // Get current branch tip
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${ref}`,
  });
  const parentSha = refData.object.sha;

  // Get current tree
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentSha,
  });
  const baseTreeSha = commitData.tree.sha;

  // Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [parentSha],
  });

  // Update branch ref
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${ref}`,
    sha: newCommit.sha,
  });

  return newCommit.sha;
}
