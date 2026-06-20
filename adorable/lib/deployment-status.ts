import { exec } from "child_process";
import { promisify } from "util";
import { readRepoMetadata, type RepoDeploymentSummary } from "./repo-storage";

const execAsync = promisify(exec);

export const DEPLOYMENT_DOMAIN_SUFFIX = "adorable.cloud.nexlayer.ai";

export type DeploymentUiStatus = {
  state: "idle" | "deploying" | "live" | "failed";
  domain: string | null;
  url: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type DeploymentTimelineEntry = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

const isBootstrapCommit = (message: string | undefined) =>
  (message ?? "").trim().toLowerCase() === "initial commit";

export const getLatestCommitSha = async (workspacePath: string) => {
  try {
    const { stdout } = await execAsync("git log --oneline -50", {
      cwd: workspacePath,
    });
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const sha = line.trim().split(" ")[0] ?? "";
      const message = line.trim().slice(sha.length + 1);
      if (!isBootstrapCommit(message) && /^[0-9a-f]{7,40}$/i.test(sha)) {
        return sha;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const getDomainForCommit = (commitSha: string) => {
  return `${commitSha.slice(0, 12)}-${DEPLOYMENT_DOMAIN_SUFFIX}`;
};

export const getDeploymentStatusForLatestCommit = async (
  repoId: string,
  isAgentRunning: boolean,
): Promise<DeploymentUiStatus> => {
  const updatedAt = new Date().toISOString();
  const metadata = await readRepoMetadata(repoId);

  if (!metadata || metadata.deployments.length === 0) {
    return {
      state: "idle",
      domain: null,
      url: null,
      commitSha: null,
      deploymentId: null,
      lastError: "No deployments found.",
      updatedAt,
    };
  }

  const latest = metadata.deployments[0] as RepoDeploymentSummary;
  const state = isAgentRunning && latest.state === "idle" ? "deploying" : latest.state;

  return {
    state,
    domain: latest.domain,
    url: latest.url,
    commitSha: latest.commitSha,
    deploymentId: latest.deploymentId,
    lastError: latest.state === "failed" ? "Deployment failed." : null,
    updatedAt,
  };
};

export const getDeploymentTimelineFromCommits = async (
  repoId: string,
  limit = 12,
): Promise<DeploymentTimelineEntry[]> => {
  const metadata = await readRepoMetadata(repoId);
  if (!metadata) return [];
  return metadata.deployments.slice(0, limit).map((d) => ({
    commitSha: d.commitSha,
    commitMessage: d.commitMessage,
    commitDate: d.commitDate,
    domain: d.domain,
    url: d.url,
    deploymentId: d.deploymentId,
    state: d.state,
  }));
};
