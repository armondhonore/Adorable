import { type UIMessage } from "ai";
import { promises as fs } from "node:fs";
import path from "node:path";

export const ADORABLE_WRAPPER_REPO_PREFIX = "adorable-meta - ";

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const MESSAGES_DIR = path.join(DATA_DIR, "messages");

const ensureDirs = async () => {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(MESSAGES_DIR, { recursive: true });
};

export type RepoConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoDeploymentSummary = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

export type RepoMetadata = {
  version: 2;
  sourceRepoId: string;
  name?: string;
  ownerId: string;
  workspacePath: string;
  githubRepo: string | null;
  previewUrl: string | null;
  conversations: RepoConversationSummary[];
  deployments: RepoDeploymentSummary[];
  productionDomain: string | null;
  productionDeploymentId: string | null;
};

const projectFile = (repoId: string) =>
  path.join(PROJECTS_DIR, `${repoId}.json`);

const messagesFile = (conversationId: string) =>
  path.join(MESSAGES_DIR, `${conversationId}.json`);

const deriveConversationTitle = (
  messages: UIMessage[] | undefined,
  fallback: string,
): string => {
  if (!Array.isArray(messages) || messages.length === 0) return fallback;
  const userMessage = messages.find((m) => m.role === "user");
  const textPart = userMessage?.parts?.find((part) => part.type === "text");
  const text = textPart && "text" in textPart ? textPart.text : "";
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return fallback;
  return clean.slice(0, 60);
};

export const readRepoMetadata = async (
  repoId: string,
): Promise<RepoMetadata | null> => {
  await ensureDirs();
  try {
    const raw = await fs.readFile(projectFile(repoId), "utf8");
    return JSON.parse(raw) as RepoMetadata;
  } catch {
    return null;
  }
};

export const writeRepoMetadata = async (
  repoId: string,
  metadata: RepoMetadata,
): Promise<void> => {
  await ensureDirs();
  await fs.writeFile(projectFile(repoId), JSON.stringify(metadata, null, 2));
};

export const listProjectsByOwner = async (
  ownerId: string,
): Promise<RepoMetadata[]> => {
  await ensureDirs();
  let files: string[];
  try {
    files = await fs.readdir(PROJECTS_DIR);
  } catch {
    return [];
  }
  const results = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const raw = await fs.readFile(path.join(PROJECTS_DIR, f), "utf8");
          return JSON.parse(raw) as RepoMetadata;
        } catch {
          return null;
        }
      }),
  );
  return results.filter(
    (m): m is RepoMetadata => m !== null && m.ownerId === ownerId,
  );
};

export const resolveSourceRepoId = async (repoId: string) => {
  const metadata = await readRepoMetadata(repoId);
  return metadata?.sourceRepoId ?? repoId;
};

export const assertRepoAccess = async (
  repoId: string,
  identityId: string,
): Promise<boolean> => {
  const metadata = await readRepoMetadata(repoId);
  return metadata?.ownerId === identityId;
};

export const createConversationInRepo = async (
  repoId: string,
  metadata: RepoMetadata,
  conversationId: string,
  initialTitle?: string,
): Promise<RepoMetadata> => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const now = new Date().toISOString();
  const normalizedTitle = initialTitle?.trim().replace(/\s+/g, " ");
  const fallbackTitle =
    normalizedTitle && normalizedTitle.length > 0
      ? normalizedTitle.slice(0, 60)
      : `Conversation ${latestMetadata.conversations.length + 1}`;

  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    conversations: [
      { id: conversationId, title: fallbackTitle, createdAt: now, updatedAt: now },
      ...latestMetadata.conversations,
    ],
  };

  await writeRepoMetadata(repoId, nextMetadata);

  // Write empty messages file
  await fs.mkdir(MESSAGES_DIR, { recursive: true });
  await fs.writeFile(messagesFile(conversationId), "[]");

  return nextMetadata;
};

export const readConversationMessages = async (
  repoId: string,
  conversationId: string,
): Promise<UIMessage[]> => {
  void repoId;
  try {
    const raw = await fs.readFile(messagesFile(conversationId), "utf8");
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
};

export const saveConversationMessages = async (
  repoId: string,
  metadata: RepoMetadata,
  conversationId: string,
  messages: UIMessage[],
): Promise<RepoMetadata> => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const now = new Date().toISOString();

  const existing = latestMetadata.conversations.find(
    (c) => c.id === conversationId,
  );
  const fallbackTitle =
    existing?.title ??
    `Conversation ${latestMetadata.conversations.length + 1}`;
  const title = deriveConversationTitle(messages, fallbackTitle);

  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    conversations: [
      {
        id: conversationId,
        title,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
      ...latestMetadata.conversations.filter((c) => c.id !== conversationId),
    ],
  };

  await Promise.all([
    writeRepoMetadata(repoId, nextMetadata),
    fs.writeFile(messagesFile(conversationId), JSON.stringify(messages, null, 2)),
  ]);

  return nextMetadata;
};

export const addRepoDeployment = async (
  repoId: string,
  metadata: RepoMetadata,
  deployment: RepoDeploymentSummary,
): Promise<RepoMetadata> => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    deployments: [
      deployment,
      ...latestMetadata.deployments.filter(
        (d) => d.commitSha !== deployment.commitSha,
      ),
    ],
  };
  await writeRepoMetadata(repoId, nextMetadata);
  return nextMetadata;
};

export const setRepoProductionDomain = async (
  repoId: string,
  metadata: RepoMetadata,
  productionDomain: string,
): Promise<RepoMetadata> => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const nextMetadata: RepoMetadata = { ...latestMetadata, productionDomain };
  await writeRepoMetadata(repoId, nextMetadata);
  return nextMetadata;
};

export const promoteRepoDeploymentToProduction = async (
  repoId: string,
  metadata: RepoMetadata,
  productionDeploymentId: string,
): Promise<RepoMetadata> => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const nextMetadata: RepoMetadata = { ...latestMetadata, productionDeploymentId };
  await writeRepoMetadata(repoId, nextMetadata);
  return nextMetadata;
};
