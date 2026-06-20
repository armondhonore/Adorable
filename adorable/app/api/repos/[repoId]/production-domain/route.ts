import { NextResponse } from "next/server";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import {
  assertRepoAccess,
  readRepoMetadata,
  setRepoProductionDomain,
} from "@/lib/repo-storage";

const normalizeDomain = (domain: string) => {
  const trimmed = domain.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  return withoutProtocol.split("/")[0] ?? "";
};

const isValidDomain = (domain: string) => {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)+$/.test(domain);
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;
  const { identityId } = await getOrCreateIdentitySession();

  if (!(await assertRepoAccess(repoId, identityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let requestedDomain = "";
  try {
    const payload = (await req.json()) as { domain?: string };
    requestedDomain = payload?.domain ?? "";
  } catch {
    requestedDomain = "";
  }

  const domain = normalizeDomain(requestedDomain);
  if (!domain || !isValidDomain(domain)) {
    return NextResponse.json(
      { error: "Invalid domain name" },
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

  const nextMetadata = await setRepoProductionDomain(repoId, metadata, domain);

  return NextResponse.json({
    productionDomain: nextMetadata.productionDomain,
    productionDeploymentId: nextMetadata.productionDeploymentId,
  });
}
