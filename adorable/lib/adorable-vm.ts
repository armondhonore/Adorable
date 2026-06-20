import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "node:fs";
import path from "node:path";

const execAsync = promisify(exec);

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

export const createWorkspaceForProject = async (
  projectId: string,
): Promise<{ workspacePath: string }> => {
  const workspacePath = path.join(WORKSPACES_DIR, projectId);
  await fs.mkdir(workspacePath, { recursive: true });

  await execAsync(
    "git init && git config user.email 'adorable@nexlayer.com' && git config user.name 'Adorable'",
    { cwd: workspacePath },
  );

  await fs.writeFile(
    path.join(workspacePath, "README.md"),
    "# Project\n\nCreated with Adorable AI on Nexlayer.\n",
  );

  await execAsync("git add -A && git commit -m 'Initial commit'", {
    cwd: workspacePath,
  });

  return { workspacePath };
};
