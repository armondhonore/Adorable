import { NextResponse } from "next/server";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import { assertRepoAccess, readConversationMessages } from "@/lib/repo-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string; conversationId: string }> },
) {
  const { repoId, conversationId } = await params;
  const { identityId } = await getOrCreateIdentitySession();

  if (!(await assertRepoAccess(repoId, identityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await readConversationMessages(repoId, conversationId);
  return NextResponse.json({ messages });
}
