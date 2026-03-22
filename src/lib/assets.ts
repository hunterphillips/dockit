// Determine the asset subcategory bucket from a file's MIME type / extension
export function assetCategory(filename: string): "diagrams" | "screenshots" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["svg", "pdf", "drawio", "excalidraw"].includes(ext)) return "diagrams";
  return "screenshots";
}

// Compute a relative path from `fromPath` to `toPath`
export function relativePath(fromPath: string, toPath: string): string {
  const from = fromPath.split("/").slice(0, -1); // dir of the source file
  const to = toPath.split("/");

  let commonLen = 0;
  while (
    commonLen < from.length &&
    commonLen < to.length &&
    from[commonLen] === to[commonLen]
  ) {
    commonLen++;
  }

  const ups = from.length - commonLen;
  const rel = [
    ...Array(ups).fill(".."),
    ...to.slice(commonLen),
  ].join("/");

  return rel;
}

// Upload an asset file to the repo and return the relative path from the doc
export async function uploadAsset(
  file: File,
  owner: string,
  repo: string,
  docPath: string
): Promise<string> {
  const category = assetCategory(file.name);
  const assetPath = `docs/.meta/assets/${category}/${file.name}`;

  // Read file as base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Commit to repo via the file API (no SHA needed — new file)
  const res = await fetch("/api/github/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner,
      repo,
      path: assetPath,
      content: base64,
      rawBase64: true,
      message: `Upload asset: ${file.name}`,
    }),
  });

  if (!res.ok) {
    const { error } = await res.json() as { error: string };
    throw new Error(`Asset upload failed: ${error}`);
  }

  return relativePath(docPath, assetPath);
}
