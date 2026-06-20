import { NextResponse } from "next/server";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import {
  assertRepoAccess,
  promoteRepoDeploymentToProduction,
  readRepoMetadata,
} from "@/lib/repo-storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;
  const { identityId } = await getOrCreateIdentitySession();

  if (!(await assertRepoAccess(repoId, identityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let deploymentId = "";
  try {
    const payload = (await req.json()) as { deploymentId?: string };
    deploymentId = payload?.deploymentId?.trim() ?? "";
  } catch {
    deploymentId = "";
  }

  if (!deploymentId) {
    return NextResponse.json(
      { error: "deploymentId is required" },
      { status: 400 },
    );
  }

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return NextResponse.json(
      { error: "Repository metadata not found" },
      { status: 404 },
    );
  }

  if (!metadata.productionDomain) {
    return NextResponse.json(
      { error: "Configure a production domain first" },
      { status: 400 },
    );
  }

  const nextMetadata = await promoteRepoDeploymentToProduction(
    repoId,
    metadata,
    deploymentId,
  );

  return NextResponse.json({
    productionDomain: nextMetadata.productionDomain,
    productionDeploymentId: nextMetadata.productionDeploymentId,
  });
}
