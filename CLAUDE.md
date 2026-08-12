# CLAUDE.md

# LightMark

Fast. Lightweight. Focused.

---

# Project Overview

LightMark is a cross-platform Markdown Viewer.

LightMark is intentionally not a Markdown editor.

Users edit documents using their preferred editor (VSCode, Cursor, Zed, Vim, Neovim, Emacs, Obsidian, etc.) and use LightMark only for rendering and reading.

Core philosophy:

- Fast startup
- Low memory usage
- Live reload
- Viewer-only experience
- Local-first
- Minimal dependencies

---

# Product Principles

## 1. Viewer First

LightMark is a viewer.

Do not add editing features.

Never introduce:

- Rich text editing
- Markdown editing
- Split editor
- Auto-save
- WYSIWYG editing

---

## 2. Lightweight Above All

Every feature must justify:

- startup cost
- runtime memory
- maintenance complexity

Prefer smaller, simpler solutions.

Avoid unnecessary abstractions.

---

## 3. Browser Development First

Frontend must work as a standalone web application.

Developers should be able to run:

```bash
npm run dev
```

and use:

- Firefox
- Chrome
- Brave

without any Tauri dependency.

---

## 4. Tauri Is Packaging Layer

Tauri is NOT part of business logic.

Tauri only provides:

- file access
- file watching
- config access
- operating system integration
- application packaging

All application behavior should remain independent from Tauri.

---

# Mandatory Reading Order

Before implementing any feature, read below files in `@docs` directory:

1. PRD.md
2. ARCHITECTURE.md
3. CONFIG_SPEC.md
4. IPC_SPEC.md
5. UI_SPEC.md
6. TASKS.md
7. PLAN.md

PRD is the source of truth.

If requirements conflict, follow:

```text
PRD
  ↓
Architecture
  ↓
Everything Else
```

---

# Technology Stack

## Frontend

Required:

- HTML
- CSS
- TypeScript
- Web Components
- Vite

Allowed:

- markdown-it
- Mermaid
- KaTeX
- Shiki

Forbidden:

- React
- Vue
- Angular
- Svelte
- jQuery
- Bootstrap

---

## Backend

Required:

- Rust

Allowed:

- notify
- serde
- tokio

---

## Packaging

Required:

- Tauri

---

# Architecture Rules

## Frontend Structure

```text
frontend/src/

core/
components/
platform/
styles/
assets/
```

---

## Core Layer

Contains:

- markdown rendering
- toc generation
- breadcrumb generation
- theme engine
- rendering logic

Core layer must never know Tauri exists.

---

## Components Layer

Contains Web Components:

```text
lm-toolbar
lm-breadcrumb
lm-toc
lm-viewer
lm-statusbar
lm-about
```

Each component must:

- have a single responsibility
- be independently testable
- avoid global state

---

## Platform Layer

Contains platform adapters.

```text
platform/backend.ts
platform/web.ts
platform/tauri.ts
```

All OS integration is isolated here.

---

# Tauri Rules

Never import Tauri APIs outside:

```text
frontend/src/platform/tauri.ts
```

Forbidden:

```ts
import { invoke } from "@tauri-apps/api/core";
```

inside any other folder.

All platform communication must pass through:

```ts
BackendApi
```

interface.

---

# Performance Requirements

## Startup

Target:

```text
< 1 second
```

---

## File Open

Target:

```text
10,000 line document
< 300ms
```

---

## Live Reload

Target:

```text
< 500ms
```

---

## Memory

Target:

```text
Normal document:
< 30MB

Large document:
< 100MB
```

---

# Lazy Loading Rules

Mandatory.

Do not load expensive libraries unless needed.

---

## Mermaid

Only load when:

```markdown
```mermaid
```
```

blocks exist.

---

## KaTeX

Only load when:

```markdown
$
$$
```

expressions exist.

---

## Shiki

Only load when code blocks exist.

---

## Images

Use lazy loading.

---

# Config Rules

No graphical settings editor.

Configuration is stored in:

```text
config.json
```

Users are expected to edit the file directly.

Application only provides:

- Open Config Folder
- Reload Config

---

# UI Rules

Layout:

```text
Toolbar
Breadcrumb
Content Area
Status Bar
```

---

## TOC

Location:

```text
Left Sidebar
```

Requirements:

- toggleable
- resizable
- hierarchical
- active section highlighting

---

## Breadcrumb

Location:

```text
Below Toolbar
```

Example:

```text
Architecture > Frontend > State Management
```

Must update automatically while scrolling.

---

# Print Rules

Provide:

```text
Print
```

Do NOT implement:

```text
PDF export engine
```

Users can print to PDF using the operating system.

During print:

Hide:

- Toolbar
- TOC
- Status Bar

---

# Coding Style

## TypeScript

Enable:

```json
{
  "strict": true
}
```

Use:

- small modules
- explicit interfaces
- explicit return types

Avoid:

- any
- large utility files
- hidden side effects

---

## Rust

Prefer:

- simple modules
- explicit types
- clear ownership

Avoid:

- unnecessary macros
- overly generic abstractions

---

# Dependency Policy

Before adding any dependency ask:

1. Can this be done using browser APIs?
2. Can this be done using existing code?
3. Is the dependency actively maintained?
4. Is the dependency required for MVP?

If any answer is negative:

Do not add the dependency.

---

# Definition of Done

A feature is complete only when:

- implementation finished
- types completed
- documentation updated
- no lint errors
- no build errors
- browser mode works
- Tauri mode works

---

# Success Metric

The project succeeds when:

- startup feels instant
- large Markdown files remain responsive
- memory usage stays low
- users can use any editor they prefer
- LightMark stays focused on viewing, not editing

Remember:

LightMark is a Markdown Viewer.

Do not turn it into an editor.