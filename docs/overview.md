# Overview

Dockit is a GitHub-backed documentation platform built for cross-functional teams — PMs, business analysts, architects, and non-technical stakeholders. It provides a structured, WYSIWYG editing experience over a GitHub repository, with no separate document database. GitHub is the single source of truth; all reads and writes go directly to the repo via Octokit.

## What it does

- **Browse and edit docs** — Users navigate a structured doc tree (sidebar) and read or edit documents in a rich WYSIWYG editor (BlockNote). Raw markdown is never exposed.
- **GitHub as the backend** — Every save is a GitHub commit. Conflict detection uses SHA comparison: if someone else saved first, the user sees a conflict banner and must reload.
- **Asset uploads** — Images and binary files are committed to a hidden `.meta/assets/` folder and referenced in documents.
- **Full-text search** — A client-side MiniSearch index is built from all docs at load time, powering a live search dropdown.
- **AI assistant** — A slide-out chat panel (powered by Claude) supports two modes: Q&A (streamed answers about the current doc and broader project context) and edit suggestions (a proposed rewrite shown as a unified diff, which the user can apply and commit in one click).

## Who uses it

Non-technical contributors who need to create and maintain structured documentation — requirements, decisions, workflows, personas, integrations — without touching Git or markdown directly. Authentication is GitHub OAuth; access control is inherited from GitHub repository permissions.

## How it's built

Dockit is a Next.js 16 App Router application (TypeScript, vanilla CSS). The UI layer is thin: no document database, no proprietary storage. Every document lives as a markdown file in the connected GitHub repo under a `docs/` directory, organized into sections defined by a config file at `docs/.meta/config.json`.
