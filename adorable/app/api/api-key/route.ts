import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "user-api-key";
const COOKIE_PROVIDER = "user-api-provider";

/** Check if a global API key is configured in the environment */
function hasGlobalKey(): boolean {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.LLM_PROVIDER === "nexlayer"
  );
}

/** GET – returns whether the user needs to provide a key */
export async function GET() {
  const jar = await cookies();
  const userKey = jar.get(COOKIE_NAME)?.value;
  const userProvider = jar.get(COOKIE_PROVIDER)?.value ?? "openai";

  return NextResponse.json({
    hasGlobalKey: hasGlobalKey(),
    hasUserKey: !!userKey,
    provider: userProvider,
  });
}

/** POST – save or delete the user's API key */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    apiKey?: string;
    provider?: "openai" | "anthropic" | "nexlayer";
    action?: "save" | "delete";
    accessCode?: string;
  };

  const jar = await cookies();

  if (body.action === "delete") {
    jar.delete(COOKIE_NAME);
    jar.delete(COOKIE_PROVIDER);
    return NextResponse.json({ ok: true });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const provider = body.provider ?? "openai";

  // Nexlayer bypass — validate 6-digit access code, no real API key needed
  if (provider === "nexlayer") {
    const expectedCode = process.env.NEXLAYER_ACCESS_CODE;
    if (!expectedCode) {
      return NextResponse.json(
        { error: "Nexlayer access not configured" },
        { status: 503 },
      );
    }
    const submitted = body.accessCode?.trim();
    if (!submitted || submitted !== expectedCode) {
      return NextResponse.json(
        { error: "Invalid access code" },
        { status: 401 },
      );
    }
  } else if (provider === "openai" && !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "OpenAI keys start with sk-" },
      { status: 400 },
    );
  }

  jar.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  jar.set(COOKIE_PROVIDER, provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
