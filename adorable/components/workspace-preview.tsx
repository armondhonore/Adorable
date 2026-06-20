"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SandpackProvider,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { Loader2Icon } from "lucide-react";

type FileMap = Record<string, { code: string }>;

const POLL_INTERVAL_MS = 3000;

const toSandpackFiles = (raw: Record<string, string>): FileMap => {
  const result: FileMap = {};
  for (const [p, code] of Object.entries(raw)) {
    result[p] = { code };
  }
  return result;
};

const hasRenderableFiles = (raw: Record<string, string>) => {
  return Object.keys(raw).some(
    (p) => p.endsWith("page.tsx") || p.endsWith("page.jsx") || p.endsWith("index.tsx") || p.endsWith("App.tsx"),
  );
};

export function WorkspacePreview({
  repoId,
  active,
}: {
  repoId: string;
  active: boolean;
}) {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${repoId}/workspace`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { files: Record<string, string> };
      setFiles(data.files);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchFiles();
    if (active) {
      pollingRef.current = setInterval(fetchFiles, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchFiles, active]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground/40">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground/60">Preview unavailable</p>
      </div>
    );
  }

  if (!files || !hasRenderableFiles(files)) {
    return <EmptyPreview />;
  }

  const sandpackFiles = toSandpackFiles(files);

  return (
    <SandpackProvider
      template="nextjs"
      files={sandpackFiles}
      options={{ externalResources: [] }}
      theme="dark"
    >
      <SandpackPreview
        style={{ height: "100%", width: "100%" }}
        showNavigator={false}
        showOpenInCodeSandbox={false}
        showRefreshButton
      />
    </SandpackProvider>
  );
}

function EmptyPreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <div className="rounded-full border border-muted/40 p-4">
        <svg
          className="size-8 text-muted-foreground/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          Preview updates as you build
        </p>
        <p className="text-xs text-muted-foreground/60">
          Ask Adorable to build something to see it here
        </p>
      </div>
    </div>
  );
}
