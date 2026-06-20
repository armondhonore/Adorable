import { tool } from "ai";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { addRepoDeployment, readRepoMetadata } from "./repo-storage";

const execAsync = promisify(exec);

type CreateToolsOptions = {
  sourceRepoId?: string;
  metadataRepoId?: string;
};

const normalizeRelativePath = (rawPath: string): string | null => {
  const value = rawPath.trim();
  if (!value || value.includes("\0") || value.startsWith("/")) return null;

  const normalized = value.replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) return null;

  return normalized || ".";
};

const shellQuote = (value: string): string => {
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

export const createTools = (workspacePath: string, options?: CreateToolsOptions) => {
  const runExecCommand = async (command: string) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspacePath,
        timeout: 30_000,
      });
      return { ok: true, stdout: stdout || "", stderr: stderr || "", exitCode: 0, command };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        ok: false,
        stdout: e.stdout || "",
        stderr: e.stderr || "",
        exitCode: e.code ?? 1,
        command,
      };
    }
  };

  const absPath = (relPath: string) => path.join(workspacePath, relPath);

  const readTextFile = async (relPath: string) =>
    fs.readFile(absPath(relPath), "utf8");

  const writeTextFile = async (relPath: string, content: string) => {
    const full = absPath(relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  };

  const getHeadCommitSha = async () => {
    const result = await runExecCommand("git rev-parse HEAD");
    if (!result.ok) return null;
    const sha = result.stdout.trim().split("\n")[0]?.trim();
    if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) return null;
    return sha;
  };

  const bashTool = tool({
    description:
      "Run a bash command inside the project workspace and return its output.",
    inputSchema: z.object({
      command: z.string().min(1).describe("The bash command to execute."),
    }),
    execute: async ({ command }) => {
      return runExecCommand(command);
    },
  });

  const readFileTool = tool({
    description:
      "Read the content of a file in the project workspace. Input is the file path relative to the workspace root.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("The path of the file to read."),
      })
      .passthrough(),
    execute: async ({ file }) => {
      if (!file) return { content: null };
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) return { ok: false, error: "Invalid file path." };
      try {
        const content = await readTextFile(safeFile);
        return { content };
      } catch {
        return { content: null, error: "File not found." };
      }
    },
  });

  const writeFileTool = tool({
    description:
      "Write content to a file in the project workspace. Input is the file path relative to the workspace root and the content to write.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("The path of the file to write."),
        content: z.string().describe("The content to write to the file."),
      })
      .passthrough(),
    execute: async ({ file, content }) => {
      const safeFile = file ? normalizeRelativePath(file) : null;
      if (!safeFile) return { ok: false, error: "File path is required." };
      await writeTextFile(safeFile, content);
      return { ok: true };
    },
  });

  const listFilesTool = tool({
    description:
      "List files or directories from a given path. Prefer this over bash for discovery.",
    inputSchema: z
      .object({
        path: z.string().default(".").describe("Path to list."),
        recursive: z
          .boolean()
          .default(false)
          .describe("Whether to list recursively."),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(8)
          .default(3)
          .describe("Maximum recursion depth when recursive is true."),
      })
      .passthrough(),
    execute: async ({ path: listPath, recursive, maxDepth }) => {
      const safePath = normalizeRelativePath(listPath ?? ".");
      if (!safePath) return { ok: false, error: "Invalid path." };

      const command = recursive
        ? `find ${shellQuote(safePath)} -maxdepth ${maxDepth} -print | sed 's#^\\./##'`
        : `ls -la ${shellQuote(safePath)}`;

      const result = await runExecCommand(command);
      return { ...result, path: safePath, recursive, maxDepth };
    },
  });

  const searchFilesTool = tool({
    description:
      "Search for text within files. Prefer this over bash grep for code/text lookup.",
    inputSchema: z
      .object({
        query: z.string().min(1).describe("Text to search for."),
        path: z.string().default(".").describe("Path to search under."),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe("Maximum number of matching lines to return."),
      })
      .passthrough(),
    execute: async ({ query, path: searchPath, maxResults }) => {
      const safePath = normalizeRelativePath(searchPath ?? ".");
      if (!safePath) return { ok: false, error: "Invalid path." };

      const command = `grep -RIn --exclude-dir=node_modules --exclude-dir=.next -- ${shellQuote(query)} ${shellQuote(safePath)} | head -n ${maxResults}`;
      const result = await runExecCommand(command);
      return { ...result, query, path: safePath, maxResults };
    },
  });

  const replaceInFileTool = tool({
    description:
      "Replace text in a file without using bash. Supports replacing first or all occurrences.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("Path of the file to edit."),
        search: z.string().describe("Text to find."),
        replace: z.string().describe("Replacement text."),
        all: z
          .boolean()
          .default(true)
          .describe("Replace all matches when true, otherwise first match."),
      })
      .passthrough(),
    execute: async ({ file, search, replace, all }) => {
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) return { ok: false, error: "Invalid file path." };

      let content: string;
      try {
        content = await readTextFile(safeFile);
      } catch {
        return { ok: false, error: "File not found." };
      }

      if (!search) return { ok: false, error: "Search text is required." };
      if (!content.includes(search)) {
        return { ok: false, file: safeFile, replacements: 0, error: "No matches found." };
      }

      const nextContent = all
        ? content.split(search).join(replace)
        : content.replace(search, replace);
      const replacements = all
        ? content.split(search).length - 1
        : content === nextContent ? 0 : 1;

      await writeTextFile(safeFile, nextContent);
      return { ok: true, file: safeFile, replacements };
    },
  });

  const appendToFileTool = tool({
    description:
      "Append text content to an existing file (or create it) without bash.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("Path of the file to append to."),
        content: z.string().describe("Text content to append."),
      })
      .passthrough(),
    execute: async ({ file, content }) => {
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) return { ok: false, error: "Invalid file path." };

      let existing = "";
      try {
        existing = await readTextFile(safeFile);
      } catch {
        existing = "";
      }

      await writeTextFile(safeFile, `${existing}${content}`);
      return { ok: true, file: safeFile, appendedBytes: content.length };
    },
  });

  const makeDirectoryTool = tool({
    description: "Create a directory path using mkdir -p semantics.",
    inputSchema: z
      .object({
        path: z.string().min(1).describe("Directory path to create."),
      })
      .passthrough(),
    execute: async ({ path: dirPath }) => {
      const safePath = normalizeRelativePath(dirPath);
      if (!safePath) return { ok: false, error: "Invalid path." };
      await fs.mkdir(absPath(safePath), { recursive: true });
      return { ok: true, path: safePath };
    },
  });

  const movePathTool = tool({
    description: "Move or rename a file or directory.",
    inputSchema: z
      .object({
        from: z.string().min(1).describe("Source path."),
        to: z.string().min(1).describe("Destination path."),
      })
      .passthrough(),
    execute: async ({ from, to }) => {
      const safeFrom = normalizeRelativePath(from);
      const safeTo = normalizeRelativePath(to);
      if (!safeFrom || !safeTo) {
        return { ok: false, error: "Invalid source or destination path." };
      }
      return runExecCommand(
        `mv ${shellQuote(safeFrom)} ${shellQuote(safeTo)}`,
      );
    },
  });

  const deletePathTool = tool({
    description: "Delete a file or directory path.",
    inputSchema: z
      .object({
        path: z.string().min(1).describe("File or directory path to delete."),
      })
      .passthrough(),
    execute: async ({ path: delPath }) => {
      const safePath = normalizeRelativePath(delPath);
      if (!safePath) return { ok: false, error: "Invalid path." };
      return runExecCommand(`rm -rf ${shellQuote(safePath)}`);
    },
  });

  const commitTool = tool({
    description:
      "Stage all current changes, commit them to the local repository. You should use this at any point you think the user would have value returning to. Always commit your changes when you finish a task.",
    inputSchema: z
      .object({
        message: z.string().min(1).describe("Commit message."),
      })
      .passthrough(),
    execute: async ({ message }) => {
      const gitCommand = `git config user.name 'Adorable' && git config user.email 'adorable@nexlayer.com' && git add -A && git commit -m ${shellQuote(message)}`;
      const commitResult = await runExecCommand(gitCommand);

      if (commitResult.ok && options?.metadataRepoId) {
        void (async () => {
          const commitSha = await getHeadCommitSha();
          if (!commitSha) return;

          const metadata = await readRepoMetadata(options.metadataRepoId!);
          if (!metadata) return;

          const domain = `${commitSha.slice(0, 12)}.adorable.cloud.nexlayer.ai`;
          await addRepoDeployment(options.metadataRepoId!, metadata, {
            commitSha,
            commitMessage: message,
            commitDate: new Date().toISOString(),
            domain,
            url: `https://${domain}`,
            deploymentId: null,
            state: "idle",
          });
        })().catch((error) => {
          console.error("Post-commit metadata update failed:", error);
        });
      }

      return { ...commitResult, deploymentQueued: false };
    },
  });

  const checkAppTool = tool({
    description:
      "Check the current state of the project. Use this to verify files are in order before finishing a task.",
    inputSchema: z
      .object({
        path: z
          .string()
          .default("/")
          .describe("The URL path to check (e.g. '/' or '/about')."),
      })
      .passthrough(),
    execute: async ({ path: checkPath }) => {
      const listResult = await runExecCommand(
        "git status --short && git log --oneline -5",
      );
      return {
        ok: true,
        message: `Workspace is ready. Use the Sandpack preview to view the app live. Deploy via commitTool to get a shareable URL.`,
        path: checkPath,
        workspaceStatus: listResult.stdout,
      };
    },
  });

  const devServerLogsTool = tool({
    description:
      "Check the project workspace git log for recent changes.",
    inputSchema: z
      .object({
        maxLines: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .default(200)
          .describe("Maximum number of log lines to return."),
      })
      .passthrough(),
    execute: async ({ maxLines }) => {
      const result = await runExecCommand(`git log --oneline -${maxLines}`);
      return result.ok
        ? { ok: true, logs: result.stdout, totalLines: result.stdout.split("\n").length }
        : { ok: false, error: "Could not read git log." };
    },
  });

  return {
    bashTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    searchFilesTool,
    replaceInFileTool,
    appendToFileTool,
    makeDirectoryTool,
    movePathTool,
    deletePathTool,
    commitTool,
    checkAppTool,
    devServerLogsTool,
  };
};
