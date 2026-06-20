import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertRepoAccess, readRepoMetadata } from "@/lib/repo-storage";
import { getOrCreateIdentitySession } from "@/lib/identity-session";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "dist",
  "out",
  ".cache",
]);

const MAX_FILE_BYTES = 512_000;

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".html",
  ".md",
  ".mdx",
  ".svg",
  ".txt",
  ".env.local",
  ".env",
  ".gitignore",
  ".mts",
]);

async function walkDir(
  dir: string,
  root: string,
  files: Record<string, string>,
  depth = 0,
) {
  if (depth > 8) return;
  let entries: fs.Dir;
  try {
    entries = await fs.opendir(dir);
  } catch {
    return;
  }
  for await (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.local" && entry.name !== ".gitignore") continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      await walkDir(path.join(dir, entry.name), root, files, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = "/" + path.relative(root, fullPath);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_FILE_BYTES) continue;
        const content = await fs.readFile(fullPath, "utf8");
        files[relPath] = content;
      } catch {
        // skip unreadable files
      }
    }
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;
  const { identityId } = await getOrCreateIdentitySession();

  if (!(await assertRepoAccess(repoId, identityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files: Record<string, string> = {};
  await walkDir(metadata.workspacePath, metadata.workspacePath, files);

  return NextResponse.json({ files });
}
