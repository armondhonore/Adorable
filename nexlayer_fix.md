# Nexlayer working build fix

This file is the authoritative, pinned build solution for this repo. Nexlayer uses it verbatim on every run and will not override it.

## CRITICAL BUILD CONSTRAINTS

1. **This is an npm workspace — NOT pnpm.** Do not use pnpm or corepack.

2. **deps stage: `COPY adorable/package.json adorable/package-lock.json ./` then `RUN npm install --legacy-peer-deps`** — do NOT use `npm ci`. The lock file MUST be copied so that existing `@assistant-ui` packages install at their pinned versions (fresh resolution causes incompatible major version mismatches). `npm install --legacy-peer-deps` respects locked versions for existing packages and resolves fresh only for new packages.

3. **`output: 'standalone'` is already set in `adorable/next.config.ts`** — do not add it again.

4. **No pnpm, no corepack, no workspace hoisting** — the adorable app builds from package.json with `npm install`.

5. **CMD must be `/bin/sh start.sh`** — `start.sh` sources `/run/secrets/app.env` (mounted secrets) as env vars then execs `node server.js`. Do NOT change the CMD to `node server.js` directly.

6. **`git` must be installed in BOTH the deps stage AND the runner stage** — deps stage needs it for npm, runner stage needs it because workspace tools run `git init/add/commit` at runtime. Add `RUN apk add --no-cache git` to the runner stage before creating users.

## Fixed Dockerfile

```dockerfile
FROM mirror.gcr.io/library/node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app
COPY adorable/package.json adorable/package-lock.json ./
RUN npm install --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY adorable/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache git

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p public .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["/bin/sh", "start.sh"]
```

## Fixed nexlayer.yaml

```yaml
application:
  name: adorable-ai
  pods:
    - name: app
      image: "# filled by pipeline"
      path: /
      servicePorts:
        - 3000
      vars:
        NODE_ENV: production
        PORT: "3000"
        LLM_PROVIDER: nexlayer
        NEXLAYER_MODEL: bode-flagship
      secrets:
        - name: app-secrets
          data: |
            VLLM_BASE_URL=# filled by platform agent
            NEXLAYER_ACCESS_CODE=# filled by platform agent
          fileName: app.env
          mountPath: /run/secrets
      volumes:
        - name: data
          mountPath: /data
          size: 5Gi
```

## Notes

**Verified: local docker build exits 0, container returns HTTP 200 on port 3000.**

- Node 22 required — `@mastra/mcp` declares `engines: { node: ">=22.13.0" }`
- `adorable/` has no `public/` directory — the runner stage creates an empty one
- `LLM_PROVIDER=nexlayer` routes to vLLM at `VLLM_BASE_URL/v1` using `@ai-sdk/openai` with `apiKey: "EMPTY"` (vLLM convention)
- `VLLM_BASE_URL` and `NEXLAYER_MODEL` must be set by the platform agent pointing at the bode-flagship deployment
- `NEXLAYER_ACCESS_CODE` must be set to the 6-digit code posted at https://www.linkedin.com/feed/update/urn:li:activity:7473497952548999168/ — the gate rejects any other value
