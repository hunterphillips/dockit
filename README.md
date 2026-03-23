# Dockit

A GitHub-backed documentation platform for cross-functional teams. Dockit is a Next.js UI layer over a GitHub repository — GitHub is the source of truth for all document content. There is no document database; reads and writes go directly to GitHub via the Octokit REST client.

Target users: PMs, business analysts, architects, and product stakeholders. The editing experience is always WYSIWYG, never raw markdown.

## Features

- **WYSIWYG editing** — BlockNote block editor with image/asset upload
- **GitHub as backend** — every save is a commit; SHA-based concurrency prevents silent overwrites
- **Full-text search** — client-side MiniSearch index built from all docs on load
- **AI assistant** — streaming Q&A and AI-suggested edit mode (Claude claude-sonnet-4-6)
- **Auto-document** — link a source code repo and let an AI agent generate documentation by reading it
- **Unified diff preview** — review AI-proposed edits before applying

## Stack

- **Next.js 16** (App Router) + TypeScript
- **next-auth v5** — GitHub OAuth
- **@octokit/rest** — all GitHub API calls
- **BlockNote** — WYSIWYG editor
- **react-markdown** + remark-gfm — document viewer
- **MiniSearch** — client-side full-text search
- **@anthropic-ai/sdk** — AI assistant and auto-doc agent
- Vanilla CSS (CSS Modules + design tokens in `globals.css`)

## Getting Started

### 1. Create a GitHub OAuth App

Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.

- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

Copy the Client ID and generate a Client Secret.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
GITHUB_CLIENT_ID=        # from your GitHub OAuth app
GITHUB_CLIENT_SECRET=    # from your GitHub OAuth app
AUTH_SECRET=             # openssl rand -base64 32
ANTHROPIC_API_KEY=       # from console.anthropic.com
```

### 3. Tag a GitHub repo as a Dockit project

Dockit only shows repos tagged with the `dockit` topic. On any GitHub repo you want to use:

> Settings → Topics → add `dockit`

### 4. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with GitHub and select a repo to get started. If the repo has no docs yet, use the "Initialize docs" button to scaffold the default structure.

## Project structure

```
src/
  app/
    layout.tsx                       # Root layout — Inter font, SessionProvider
    page.tsx                         # Landing — project selector (requires auth)
    login/page.tsx                   # Sign-in page
    proxy.ts                         # Auth middleware (Next.js 16: proxy.ts, not middleware.ts)
    [owner]/[repo]/
      layout.tsx                     # Project layout — AppShell + ProjectProvider
      page.tsx                       # Overview page (docs/overview.md)
      [...path]/
        page.tsx                     # Doc page — server fetches file + SHA
        DocPageClient.tsx            # Client: view/edit toggle, auto-doc
    api/
      github/
        repos/route.ts               # GET — list user repos (filtered by dockit topic)
        tree/route.ts                # GET — repo file tree
        file/route.ts                # GET/PUT — read or write a file
        commit/route.ts              # POST — atomic multi-file commit
        scaffold/route.ts            # POST — initialize default doc template
        project/link/route.ts        # PUT — set or clear linkedRepo in config
      ai/
        chat/route.ts                # POST — Q&A (SSE) or edit-suggestion mode
        auto-doc/route.ts            # POST — agentic doc generation from source repo (SSE)
  components/
    layout/
      AppShell.tsx                   # Three-panel grid layout
      Sidebar.tsx                    # Collapsible doc tree
      Header.tsx                     # Breadcrumb, search, AI toggle, repo link
      SearchBar.tsx                  # Live full-text search dropdown
    docs/
      DocViewer.tsx                  # react-markdown renderer
      DocEditor.tsx                  # BlockNote editor + SHA conflict detection
    ai/
      ChatPanel.tsx                  # Slide-out AI panel (Q&A + edit mode)
      DiffPreview.tsx                # Unified diff view with apply-and-commit
  context/
    ProjectContext.tsx               # Tree, config, search index
    AIPanelContext.tsx               # AI panel state + DocPageClient bridge
  lib/
    auth.ts                          # next-auth config + getToken() helper
    github-client.ts                 # Octokit wrappers
    markdown.ts                      # Frontmatter parsing, image resolution
    taxonomy.ts                      # Default doc template, config parsing
    search.ts                        # MiniSearch index helpers
    assets.ts                        # Binary asset upload to .meta/assets/
    ai.ts                            # assembleDocContext() for AI prompts
    auto-doc-agent.ts                # Agentic Anthropic loop for auto-documentation
```

## Dev commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build + type check
npm run start    # start production server
```

## Key conventions

- **Auth**: all GitHub tokens stay server-side. `getToken()` throws if no token → API routes return 401.
- **SHA concurrency**: pass the current `sha` on every file write. A stale SHA returns 409 → conflict banner in the editor.
- **Doc tree**: only `docs/` paths are shown in the sidebar. `docs/.meta/` is always hidden.
- **CSS**: design tokens in `globals.css`, CSS Modules per component. No Tailwind, no dark mode.
- **Middleware**: Next.js 16 uses `src/proxy.ts` (not `src/middleware.ts`).
