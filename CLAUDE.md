# Dockit — Claude Code Guide

## What this project is

Dockit is a GitHub-backed documentation platform for cross-functional teams. It is a Next.js UI layer over a GitHub repo — GitHub is the source of truth for all document content. The app has no document database; it commits directly to GitHub via Octokit.

Target users: PMs, business analysts, architects, and product stakeholders. The editing experience is WYSIWYG, never raw markdown.

## ⚠️ Next.js version warning

This project uses **Next.js 16**, which has breaking changes from earlier versions — APIs, file conventions, and behavior may differ significantly from pre-16 training data. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the relevant guide. Heed deprecation notices.

Known breaking change already encountered: auth middleware is `src/proxy.ts`, not `src/middleware.ts`.

## Stack

- **Next.js 16 App Router** + TypeScript
- **Vanilla CSS** — design tokens in `src/app/globals.css`, CSS Modules per component. No Tailwind.
- **next-auth v5 (beta)** — GitHub OAuth. Auth config in `src/lib/auth.ts`.
- **@octokit/rest** — all GitHub API calls go through `src/lib/github-client.ts`
- **BlockNote** (`@blocknote/react`, `@blocknote/mantine`) — WYSIWYG block editor
- **react-markdown** + remark-gfm + remark-frontmatter + rehype-raw — doc viewer
- **MiniSearch** — client-side full-text search index
- **@anthropic-ai/sdk** — AI assistant; streaming Q&A + edit-suggestion mode
- **diff** — client-side unified diff for AI edit preview

## Dev commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build + type check
npm run start    # start production server
```

## Project structure

```
src/
  app/
    layout.tsx                        # Root layout — Inter font, SessionProvider
    page.tsx                          # Project selector (landing, requires auth)
    login/page.tsx                    # Sign-in page (GitHub OAuth)
    proxy.ts                          # Auth middleware (Next.js 16 uses "proxy" not "middleware")
    [owner]/[repo]/
      layout.tsx                      # Project layout — wraps AppShell + ProjectProvider
      page.tsx                        # Overview page (renders docs/overview.md)
      [...path]/
        page.tsx                      # Doc page — server fetches file + SHA, renders DocPageClient
        DocPageClient.tsx             # Client: view/edit toggle, auto-doc modal trigger + SSE consumer
    api/
      auth/[...nextauth]/route.ts     # next-auth handler
      github/
        repos/route.ts                # GET — list user's repos
        tree/route.ts                 # GET — fetch repo file tree (filters .meta/)
        file/route.ts                 # GET/PUT — read or write a file; PUT restricted to docs/ paths; rawBase64 flag for binary
        commit/route.ts               # POST — multi-file atomic commit via Git Data API
        scaffold/route.ts             # POST — initialize default doc template in a repo
        project/route.ts              # POST — create new dockit repo (tagged + scaffolded)
        project/link/route.ts         # PUT — set or clear linkedRepo in docs/.meta/config.json
      ai/
        chat/route.ts                 # POST — qa mode: SSE stream; edit mode: full JSON { proposed }
        auto-doc/route.ts             # POST — auth-checked before stream; SSE; runs agent, commits result
  components/
    layout/
      AppShell.tsx                    # Grid layout (sidebar + header + main)
      Sidebar.tsx                     # Collapsible doc tree, reads from ProjectContext
      Header.tsx                      # Breadcrumb, SearchBar, link-status button, AI toggle, user menu
      SearchBar.tsx                   # Live full-text search dropdown (MiniSearch)
    docs/
      DocViewer.tsx                   # react-markdown renderer (GFM, raw HTML, frontmatter)
      DocEditor.tsx                   # BlockNote WYSIWYG editor; handles SHA conflict detection
      RawEditor.tsx                   # Plain textarea markdown editor (fallback / power-user mode)
      AutoDocModal.tsx                # Confirmation modal before auto-doc runs; fetches source tree, file/folder selection with checkboxes
    ai/
      ChatPanel.tsx                   # Fixed slide-out AI panel; streaming Q&A + edit mode
      DiffPreview.tsx                 # Unified diff view; Apply & Commit → PUT file + updateSearchEntry
    ProjectSelector.tsx               # Landing page: repo grid, init docs button
  context/
    ProjectContext.tsx                # Provides tree, config, searchIndex, refreshTree, updateSearchEntry
    AIPanelContext.tsx                # AI panel open state + docState bridge between ChatPanel and DocPageClient
  lib/
    auth.ts                           # next-auth config + getToken() helper
    github-client.ts                  # Octokit wrappers: listRepos, getRepoTree, getFile, putFile, commitFiles
    markdown.ts                       # parseFrontmatter, resolveImageSrc, markdownToPlainText, extractTitle
    taxonomy.ts                       # Default doc template, config parsing, getDisplayName
    search.ts                         # MiniSearch index: buildSearchIndex, searchIndex, SearchResult
    assets.ts                         # uploadAsset() — encodes file as base64, commits to .meta/assets/
    ai.ts                             # assembleDocContext() — fetches all docs, truncates at 150K chars
    auto-doc-agent.ts                 # Claude tool_use loop: list_repo_tree + read_file; selectedPaths focus hint; graceful wrap-up at limits
```

## Key conventions

### Auth

All GitHub tokens stay server-side. `getToken()` reads the session and returns the access token or throws. API routes call `getToken()` at the top — no token means 401.

### GitHub as backend

No database for document content. Read = `GET /api/github/file`. Write = `PUT /api/github/file` (pass `sha` for updates; GitHub rejects on SHA mismatch → 409 = conflict). Multi-file commits use the Git Data API via `commitFiles()`.

### CSS design system

Light theme (Notion-style). All colors, spacing, typography via CSS custom properties defined in `globals.css`. **No dark mode.** CSS Modules for component-scoped styles. Never use inline styles for anything that belongs in the design system.

### Middleware filename

Next.js 16 uses `src/proxy.ts` (not `src/middleware.ts`) for route middleware. The export interface is the same (`export default auth(...)`, `export const config = {...}`).

### Doc tree conventions

- Only `docs/` paths are shown in the sidebar
- `docs/.meta/` is hidden from the tree and never shown in the UI (filtered in `tree/route.ts`)
- `_index.md` files are section landing pages — hidden from sidebar items, but their parent folder is clickable
- `docs/.meta/config.json` holds display names, icon mappings, and the optional `linkedRepo: { owner, repo }` field; parsed by `taxonomy.ts`

### BlockNote editor

- Loaded client-side only via `dynamic(() => import(...), { ssr: false })`
- `uploadFile` handler on the editor calls `uploadAsset()` in `lib/assets.ts`
- Binary asset uploads use `rawBase64: true` flag on the file PUT route to skip UTF-8 encoding

### SHA-based concurrency

On save, `DocEditor.tsx` passes the stored `sha` to `PUT /api/github/file`. A 409 response means someone else saved first → show conflict banner. The user must reload.

### AI assistant

`AIPanelContext` is the bridge between `ChatPanel` (fixed overlay, lives in `AppShell`) and `DocPageClient` (knows the current file path/content/sha). `DocPageClient` writes its state to context on every render; `onEditAppliedRef` is a callback ref ChatPanel calls after a successful commit to update DocPageClient's local state. Model: `claude-sonnet-4-6`.

### Auto-doc agent

When a project has `linkedRepo` set in config, a "✦ Auto-document" button appears on doc pages. Clicking it opens `AutoDocModal` — a centered overlay that fetches the source repo's file tree and lets the user select specific files/folders to focus the agent on. Folder checkboxes support indeterminate state (set via `ref` callback, not a React prop). Empty selection = full exploration fallback.

On confirm, `DocPageClient` POSTs `{ owner, repo, filePath, sha, selectedPaths }` to `/api/ai/auto-doc`. The route validates auth and `filePath` before opening the SSE stream. It runs `runAutoDocAgent()` — a Claude tool_use loop with two tools (`list_repo_tree`, `read_file`). Limits: 20 file reads, 5 tree calls, 30 loop iterations. When any limit is hit the loop breaks and sends a "wrap up now" message to the model for a graceful final generation — no error is surfaced to the user. If `selectedPaths` is non-empty, the system prompt includes a focus block telling the model to prioritize those paths. The route streams SSE progress events (`status` / `done` / `error`) and commits the result directly. The client updates content + SHA in place on completion. No review step.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
AUTH_SECRET=           # openssl rand -base64 32
ANTHROPIC_API_KEY=     # needed for Phase 9 (AI assistant)
SHARE_LINK_SECRET=     # openssl rand -hex 32 (Phase 10)
DATABASE_URL=./dockit.db  # SQLite, Phase 10
```

## Implementation status

| Phase | Feature                                          | Status     |
| ----- | ------------------------------------------------ | ---------- |
| 1     | Bootstrap, design system, GitHub OAuth           | ✅ Done    |
| 2     | GitHub integration layer (Octokit + API routes)  | ✅ Done    |
| 3     | Navigation, project selector, sidebar            | ✅ Done    |
| 4     | Document viewing (react-markdown)                | ✅ Done    |
| 5     | Scaffolding (default template)                   | ✅ Done    |
| 6     | Document editing (BlockNote, SHA concurrency)    | ✅ Done    |
| 7     | Asset upload (.meta/assets/)                     | ✅ Done    |
| 8     | Full-text search (MiniSearch)                    | ✅ Done    |
| 9     | AI assistant (Anthropic, ChatPanel, DiffPreview) | ✅ Done    |
| —     | Source repo linking + auto-doc agent             | ✅ Done    |
| —     | Auto-doc file selection modal                    | ✅ Done    |
| 10    | Share links (SQLite, read-only viewer)           | 🔲 Pending |

## What's NOT in v1

Branching/PR workflow, platform importers, MCP server, real-time collaboration, multi-repo projects, vector/RAG search, per-section permissions beyond GitHub access.
