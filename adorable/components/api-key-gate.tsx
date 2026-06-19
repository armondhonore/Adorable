"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ExternalLinkIcon,
  Loader2Icon,
  SettingsIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Provider = "openai" | "anthropic" | "nexlayer";

type ApiKeyStatus = {
  hasGlobalKey: boolean;
  hasUserKey: boolean;
  provider: Provider;
};

/* ------------------------------------------------------------------ */
/*  Funny block messages — shown when user tries OpenAI / Anthropic   */
/* ------------------------------------------------------------------ */

const FUNNY_MESSAGES = [
  {
    heading: "Sorry Mario...",
    body: "Our princess is in another castle 🍄",
    gif: null,
  },
  {
    heading: "Ah ah ah!",
    body: "You didn't say the magic word.",
    gif: "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyM2U5dmRoZnU1NHgybnEzYmZjYmJuZ3FkcmFyMnN2aGV1ZzY3aDg1ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohzdQ1IynzclJldUQ/source.gif",
  },
  {
    heading: "Not today 🙅",
    body: "Nexlayer access codes only around here.",
    gif: null,
  },
  {
    heading: "Not on my watch ⌚",
    body: "Those keys belong in another castle.",
    gif: null,
  },
  {
    heading: "Show me the money! 💸",
    body: "...just kidding. Nexlayer access code, please.",
    gif: null,
  },
  {
    heading: "We're going to Disney World! 🏰",
    body: "But first — enter your Nexlayer access code.",
    gif: null,
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Gate – shown when no API key is configured anywhere                */
/* ------------------------------------------------------------------ */

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const checkStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/api-key");
      if (res.ok) {
        const data = (await res.json()) as ApiKeyStatus;
        setStatus(data);
      }
    } catch {
      setStatus({ hasGlobalKey: true, hasUserKey: false, provider: "openai" });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (status?.hasGlobalKey || status?.hasUserKey) {
    return <>{children}</>;
  }

  return <ApiKeySetupScreen onSaved={checkStatus} />;
}

/* ------------------------------------------------------------------ */
/*  Full-screen setup                                                  */
/* ------------------------------------------------------------------ */

function ApiKeySetupScreen({ onSaved }: { onSaved: () => void }) {
  const [accessCode, setAccessCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Funny block modal state
  const [blockedOpen, setBlockedOpen] = React.useState(false);
  const [blockedMsg, setBlockedMsg] = React.useState<(typeof FUNNY_MESSAGES)[number] | null>(null);

  const handleBlockedProviderClick = () => {
    const msg = FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
    setBlockedMsg(msg);
    setBlockedOpen(true);
  };

  const handleSave = async () => {
    if (!accessCode.trim()) {
      setError("Please enter the access code");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "nexlayer",
          provider: "nexlayer",
          accessCode: accessCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid access code");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-md space-y-8 px-6">
        {/* Nexlayer branding */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#22b7cb]/10">
              <svg
                viewBox="0 0 527 497"
                className="size-8"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Nexlayer"
              >
                <path
                  fill="#22b7cb"
                  d="M293.24,126.6V0L0,158.84v337.86l233.72-126.61v126.62l293.23-158.86V0l-233.71,126.6ZM233.72,158.84v143.56l-174.2,94.37v-202.48l174.2-94.37v58.92ZM467.43,302.4l-174.19,94.37v-202.48l174.19-94.37v202.48Z"
                />
              </svg>
            </div>
            <span className="text-[11px] font-medium tracking-wide text-[#22b7cb] uppercase">
              Powered by Nexlayer
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Add your API key
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Adorable needs an LLM API key to work. Your key is stored securely
              in an HTTP-only cookie and never shared.
            </p>
          </div>
        </div>

        {/* Provider toggle */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Provider
            </label>
            <div className="flex gap-2">
              {/* OpenAI — blocked */}
              <button
                type="button"
                onClick={handleBlockedProviderClick}
                className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                OpenAI
              </button>
              {/* Anthropic — blocked */}
              <button
                type="button"
                onClick={handleBlockedProviderClick}
                className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                Anthropic
              </button>
              {/* Nexlayer — the only real option */}
              <button
                type="button"
                className="flex-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Nexlayer
              </button>
            </div>
          </div>

          {/* Access code input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Access code
            </label>
            <Input
              type="text"
              maxLength={6}
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setError(null);
              }}
              placeholder="Access code"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-[13px] text-destructive">{error}</p>
            )}
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Don&apos;t have the code?{" "}
              <a
                href="https://www.linkedin.com/feed/update/urn:li:activity:7473497952548999168/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-blue-500 hover:underline"
              >
                Get it from this post
                <ExternalLinkIcon className="size-3" />
              </a>
            </p>
          </div>

          {/* Continue button */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || !accessCode.trim()}
          >
            {saving ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>

      {/* Funny block modal */}
      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {blockedMsg?.heading}
            </DialogTitle>
          </DialogHeader>
          {blockedMsg?.gif && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blockedMsg.gif}
              alt={blockedMsg.heading}
              className="mx-auto w-full max-w-xs rounded-lg"
            />
          )}
          {blockedMsg?.body && (
            <p className="text-sm text-muted-foreground">{blockedMsg.body}</p>
          )}
          <Button
            className="mt-2 w-full bg-[#22b7cb] hover:bg-[#1da5b8] text-white"
            onClick={() => setBlockedOpen(false)}
          >
            Fine, I&apos;ll use Nexlayer 😤
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings dialog – for changing/deleting key from within the app    */
/* ------------------------------------------------------------------ */

export function ApiKeySettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ApiKeyStatus | null>(null);
  const [provider, setProvider] = React.useState<Provider>("openai");
  const [apiKey, setApiKey] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setApiKey("");
    setError(null);
    void (async () => {
      const res = await fetch("/api/api-key");
      if (res.ok) {
        const data = (await res.json()) as ApiKeyStatus;
        setStatus(data);
        setProvider(data.provider);
      }
    })();
  }, [open]);

  const handleSave = async () => {
    const key = apiKey.trim();
    if (!key) {
      setError("Please enter an API key");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setOpen(false);
    } catch {
      setError("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      setOpen(false);
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          title="API key settings"
        >
          <SettingsIcon className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Key Settings</DialogTitle>
          <DialogDescription>
            {status?.hasGlobalKey
              ? "A global API key is configured. You can optionally override it with your own."
              : "Your API key is stored in an HTTP-only cookie."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Provider
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setProvider("openai"); setError(null); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  provider === "openai"
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => { setProvider("anthropic"); setError(null); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  provider === "anthropic"
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                Anthropic
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {status?.hasUserKey ? "Replace API key" : "API key"}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(null); }}
              placeholder={
                status?.hasUserKey
                  ? "Enter new key to replace…"
                  : provider === "openai"
                    ? "sk-..."
                    : "sk-ant-..."
              }
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
            {error && (
              <p className="mt-1.5 text-[13px] text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                OpenAI <ExternalLinkIcon className="size-3" />
              </a>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                Anthropic <ExternalLinkIcon className="size-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              {status?.hasUserKey && !status?.hasGlobalKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Removing…" : "Remove key"}
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
