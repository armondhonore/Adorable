import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createWorkspaceForProject } from "@/lib/adorable-vm";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import {
  type RepoMetadata,
  createConversationInRepo,
  listProjectsByOwner,
  writeRepoMetadata,
} from "@/lib/repo-storage";

const toDisplayRepoName = (name?: string | null) => {
  if (!name) return undefined;
  return name.startsWith("adorable-meta - ")
    ? name.slice("adorable-meta - ".length)
    : name;
};

export async function GET() {
  const { identityId } = await getOrCreateIdentitySession();
  const projects = await listProjectsByOwner(identityId);

  const items = projects.map((metadata) => ({
    id: metadata.sourceRepoId,
    name: toDisplayRepoName(metadata.name) ?? "Untitled Project",
    metadata,
  }));

  return NextResponse.json({
    identityId,
    repositories: items,
  });
}

export async function POST(req: Request) {
  const { identityId } = await getOrCreateIdentitySession();

  let requestedName: string | undefined;
  let requestedConversationTitle: string | undefined;
  try {
    const payload = (await req.json()) as {
      name?: string;
      conversationTitle?: string;
    };
    const nextName = payload?.name?.trim();
    const nextConversationTitle = payload?.conversationTitle?.trim();
    requestedName = nextName ? nextName : undefined;
    requestedConversationTitle = nextConversationTitle
      ? nextConversationTitle
      : undefined;
  } catch {
    requestedName = undefined;
    requestedConversationTitle = undefined;
  }

  const projectId = randomUUID();

  const { workspacePath } = await createWorkspaceForProject(projectId);

  const inferredName = requestedName ?? "Project";

  const initialMetadata: RepoMetadata = {
    version: 2,
    sourceRepoId: projectId,
    name: inferredName,
    ownerId: identityId,
    workspacePath,
    githubRepo: null,
    previewUrl: null,
    conversations: [],
    deployments: [],
    productionDomain: null,
    productionDeploymentId: null,
  };

  await writeRepoMetadata(projectId, initialMetadata);

  const conversationId = randomUUID();
  const metadata = await createConversationInRepo(
    projectId,
    initialMetadata,
    conversationId,
    requestedConversationTitle,
  );

  return NextResponse.json({
    id: projectId,
    metadata,
    conversationId,
  });
}

