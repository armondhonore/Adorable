# Nexlayer — Adorable

<!-- nexlayer:meta version=1 analyzed=2026-06-19T12:20:27Z repo=https://github.com/armondhonore/Adorable branch=nexlayer -->

> **For AI agents (Claude Code, Cursor, Gemini CLI, Copilot):**
> This file is the **project context** for this Nexlayer deployment — tech stack, env vars, secrets, live URL.
> For full platform detail (nexlayer.yaml schema, Dockerfile rules, CI/CD, task recipes) read **`nexlayer.skills`** in this repo.
>
> **Critical rules (full detail in `nexlayer.skills`):**
> - Inter-pod refs: `${podName:port}` only — never `localhost` or bare hostnames
> - Docker Hub images: prefix with `mirror.gcr.io/library/` — bare tags fail on the cluster
> - Secrets: set in the Nexlayer dashboard — never commit to `nexlayer.yaml` or Dockerfile
>
> **This file:** `agent-managed` sections update automatically. `user-editable` sections (Local Development Setup, Nexlayer Deployment Plan, Build Notes) are yours — preserved across re-analysis.

## Project Summary
<!-- nexlayer:section agent-managed=project_summary -->
Adorable is an open-source AI app builder that allows users to describe an application and have it built in real-time using a sandboxed VM environment with live preview and GitHub synchronization.
<!-- nexlayer:end -->

## Technology Stack
<!-- nexlayer:section agent-managed=tech_stack -->
| Name | Kind | Version | Detected From |
|------|------|---------|---------------|
| Next.js | framework | Latest (App Router) | README.md |
| TypeScript | language | Latest | README.md |
| Vercel AI SDK | ml | Latest | README.md |
| Freestyle | infra | Latest | README.md |
| Node.js | language | 22-alpine | Dockerfile |
<!-- nexlayer:end -->

## Repository Structure
<!-- nexlayer:section agent-managed=structure_map -->
- adorable/ — Core Next.js application source
- Dockerfile — Multi-stage build for standalone Next.js deployment
- package.json — Root workspace configuration
<!-- nexlayer:end -->

## External Services Required
<!-- nexlayer:section agent-managed=external_deps -->
Services that must be configured separately (not deployed by Nexlayer):

- OpenAI API
- Anthropic API
- Freestyle Cloud VMs
- GitHub API (for sync)
<!-- nexlayer:end -->

## Local Development Setup
<!-- nexlayer:section user-editable=local_setup -->
### Prerequisites

- Node.js >= 22
- npm

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
FREESTYLE_API_KEY=your_key
```

### Steps

1. `cd adorable` — Navigate to the app directory
2. `npm install` — Install dependencies
3. `cp .env.example .env.local` — Setup environment variables
4. `npm run dev` — Start development server on http://localhost:3000

<!-- nexlayer:end -->

## Nexlayer Setup
<!-- nexlayer:section agent-managed=nexlayer_setup -->
### Pod Environment Variables

| Pod | Variable | Value | Kind |
|-----|----------|-------|------|
| `app` | `NODE_ENV` | `production` | plain |
| `app` | `PORT` | `"3000"` | plain |
| `app` | `LLM_PROVIDER` | `nexlayer` | plain |
| `app` | `VLLM_BASE_URL` | `"# filled by platform agent"` | plain |
| `app` | `NEXLAYER_MODEL` | `bode-flagship` | plain |
| `app` | `NEXLAYER_ACCESS_CODE` | `"FunDay"` | plain |

### nexlayer.yaml

```yaml
application:
  name: adorable-ai
  pods:
    - name: app
      image: "registry.nexlayer.io/user_01kece1xyh817dwff7wnarhkxd/adorable:19ee2c1ec27"
      path: /
      servicePorts:
        - 3000
      vars:
        NODE_ENV: production
        PORT: "3000"
        LLM_PROVIDER: nexlayer
        VLLM_BASE_URL: "# filled by platform agent"
        NEXLAYER_MODEL: bode-flagship
        NEXLAYER_ACCESS_CODE: "FunDay"
```
<!-- nexlayer:end -->

## Nexlayer Deployment Plan
<!-- nexlayer:section user-editable=deployment_plan -->
### Pod Topology

| Pod | Image | Port | Role |
|-----|-------|------|------|
| adorable-web | mirror.gcr.io/library/node:22-alpine | 3000 | web |

### Deployment notes

- The application uses external managed services (Freestyle, OpenAI, Anthropic) rather than internal database pods for its core persistence and compute logic.
- Next.js is deployed in standalone mode using the mirror.gcr.io/library/node:22-alpine image to comply with Nexlayer platform rules.

<!-- nexlayer:end -->

## Build Notes
<!-- nexlayer:section user-editable=build_notes -->
<!-- Add notes for future builds here — preserved across re-analysis -->
<!-- nexlayer:end -->

## Nexlayer Configuration
<!-- nexlayer:section agent-managed=nexlayer_config -->
**Last deployed:** 2026-06-20T02:03:09Z  
**Live URL:** https://relaxed-weasel-adorable-ai.cloud.nexlayer.ai  
**Runtime:**  · **Port:** auto-detected  
**Deploy branch:** nexlayer  

```yaml
application:
  name: adorable-ai
  pods:
    - name: app
      image: "registry.nexlayer.io/user_01kece1xyh817dwff7wnarhkxd/adorable:19ee2c1ec27"
      path: /
      servicePorts:
        - 3000
      vars:
        NODE_ENV: production
        PORT: "3000"
        LLM_PROVIDER: nexlayer
        VLLM_BASE_URL: "# filled by platform agent"
        NEXLAYER_MODEL: bode-flagship
        NEXLAYER_ACCESS_CODE: "FunDay"
```
<!-- nexlayer:end -->

## Build History
<!-- nexlayer:section agent-managed=build_history -->
| Date | Status | Notes |
|------|--------|-------|
| 2026-06-20T02:00:43Z | analyzed | initial repo analysis |
| 2026-06-20T02:03:09Z | success | deployed https://relaxed-weasel-adorable-ai.cloud.nexlayer.ai |
<!-- nexlayer:end -->

