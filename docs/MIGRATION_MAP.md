# DocCheck AI → Humanly AI Migration Map

> Task 001 deliverable. Every file in `src/`, `supabase/` and the root configuration is
> classified. Inventory was built from the actual source tree, not the README (which is
> unchanged create-next-app boilerplate and describes none of the features).
>
> Classification legend:
> **RETAIN** = reusable with minimal changes · **REFACTOR** = useful but needs
> architectural change · **REPLACE** = must be replaced for the new architecture ·
> **OPTIONAL** = keep as an optional integration · **DEPRECATE** = no longer required.

---

## 1. Complete file inventory (44 source files)

### 1.1 Application pages — `src/app/`

| File | Functionality (verified) | Class | New destination | Required changes | Dependencies | Migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| `layout.tsx` | Root layout: Sidebar + Header + TooltipProvider, Geist fonts, **hardcoded "DocCheck AI" metadata** | REFACTOR | `src/app/layout.tsx` (Humanly AI shell) | Rebrand title/description; keep structure | Sidebar, Header, TooltipProvider | Low — cosmetic + shell only |
| `page.tsx` | Landing page: hero + 6-feature grid + CTA, all DocCheck copy | REFACTOR | `src/app/page.tsx` | Rewrite copy for Humanly AI writing workspace; feature list changes (no plagiarism/AI-detection cards unless kept optional) | motion, AnimatedCard/Container, MotionButton | Low |
| `template.tsx` | Route transition animations + writes `doccheck:last-document` to localStorage | RETAIN | `src/app/template.tsx` | Rename localStorage key (`humanly:last-document`); logic otherwise product-agnostic | motion, next/navigation | Low — key rename orphans existing values (acceptable) |
| `upload/page.tsx` | Dropzone upload with XHR progress, client-side validation, status machine | REFACTOR | `src/app/upload/page.tsx` (or new workspace intake) | Wire to new app API (create-document → async analysis instead of one blocking request); status states `parsing`/`analyzing` are declared but never set — fix while here | react-dropzone, `file-utils`, Button, Progress, AnimatedCard | **Medium** — upload flow becomes async with background analysis |
| `dashboard/[id]/page.tsx` | Stats cards, filtered issue list, plagiarism/AI panels; fetches via `GET /api/download/{id}` | REFACTOR | `src/app/dashboard/[id]/page.tsx` or new `/workspace/[id]` | Point at new app API; plagiarism/AI panels only if OPTIONAL integrations kept; de-duplicate inline `Issue`/`AnalysisData` interfaces → import from `src/types` | Tabs, Badge, IssueCard, Animated* | **Medium** — data contract changes |
| `editor/[id]/page.tsx` | Split view (read-only original + `<textarea>` edit + correction panel), apply-one/apply-all, undo stack, reset, download revised | **REPLACE** (editor core) / REFACTOR (shell) | Tiptap-based writing workspace (`src/app/workspace/[id]/page.tsx`) | Replace `<textarea>` with Tiptap; offset-based `locateIssue()`/`indexOf` correction logic replaced by Tiptap decorations + positions; undo stack → Tiptap history; keep toolbar UX patterns | motion, ScrollArea, Badge, `/api/correct` | **HIGH** — core interaction rewrite; offset-drift bug class disappears only if replaced properly |
| `report/[id]/page.tsx` | HTML report view + PDF download trigger | RETAIN (presentational) | `src/app/report/[id]/page.tsx` | Swap fetch endpoint; optional sections for plagiarism/AI | Animated*, Badge, Separator, `/api/report` | Low |
| `results/[id]/page.tsx` | Post-analysis summary + DOCX/PDF download + quick actions | RETAIN | `src/app/results/[id]/page.tsx` | Swap fetch/download endpoints | Animated*, Badge, `/api/correct`, `/api/report` | Low |
| `globals.css` | Tailwind 4 CSS-first theme (oklch tokens, shadcn `base-nova` vars) | RETAIN | same | Add Humanly AI brand tokens if desired; no Tailwind 4 migration needed (already on 4) | Tailwind 4, tw-animate-css, shadcn/tailwind.css | Low |
| `favicon.ico` | Default favicon | RETAIN | same | Rebrand later | — | Low |

### 1.2 API route handlers — `src/app/api/`

| File | Functionality | Class | New destination | Required changes | Dependencies | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `upload/route.ts` | Synchronous monolith: validate → parse → Supabase upload → insert row → LanguageTool + PrepostSEO + ai-checker calls → upsert analysis | **REFACTOR** (split) | `POST /api/documents` (create + parse + store) and background analysis step | Remove Supabase; write to SQLite (Prisma) + local `originals/`; grammar/plagiarism/AI-detection calls move to the AI service contract; split the blocking request | document-parser, grammar-engine, plagiarism/ai-detection services, supabase/admin, db.ts | **HIGH** — largest behavioral change in the app |
| `correct/route.ts` | Rebuild corrected text (editor flow or replay stored corrections), generate DOCX, store revised file, patch analysis | REFACTOR | `POST /api/documents/[id]/export` (or keep `/api/correct`) | Replace Supabase storage write with local `processed/`; Prisma update; later, rewritten text comes from rewrite sessions | docx-generator, supabase/admin, db.ts | Medium |
| `report/route.ts` | jsPDF report → Supabase bucket → reports row → PDF bytes | RETAIN (logic) + REFACTOR (storage) | `POST /api/documents/[id]/report` | Storage swap only; optional integrations sections guarded | pdf-report-generator, supabase/admin, db.ts | Low |
| `download/[id]/route.ts` | Dual-purpose: `?type=` file streaming **and** `{document, analysis}` JSON used by four pages | REFACTOR | Split into `GET /api/documents/[id]` (JSON) + `GET /api/documents/[id]/file?type=` (stream) | Local filesystem reads; **add authorization**; sanitize `Content-Disposition` filename (current raw `file_name` injection risk) | db.ts, supabase/admin | **Medium-High** — four pages depend on this shape; security fix required |

### 1.3 Components — `src/components/`

| File | Functionality | Class | New destination | Required changes | Risk |
| --- | --- | --- | --- | --- | --- |
| `layout/Sidebar.tsx` | Collapsible nav; doc-scoped links enabled from URL or localStorage last-document | REFACTOR | same path | Rebrand; nav items change (workspace, history, settings); localStorage key rename | Low |
| `layout/Header.tsx` | Breadcrumb header from pathname | RETAIN | same | Add route labels for new pages | Low |
| `dashboard/IssueCard.tsx` | Issue display card (type badge, message, suggestion) | RETAIN (if grammar issues kept) / OPTIONAL | same or workspace panel | Type imports dedupe only | Low |
| `animated/AnimatedCard.tsx` | Spring card wrapper w/ hover | RETAIN | same | none | Low |
| `animated/AnimatedContainer.tsx` | Stagger container + item variants | RETAIN | same | none | Low |
| `animated/MotionButton.tsx` | Button wrapper w/ scale-on-hover | RETAIN | same | none | Low |
| `ui/button.tsx` | shadcn base-nova button (@base-ui) | RETAIN | same | none | Low |
| `ui/badge.tsx` | Badge (@base-ui useRender) | RETAIN | same | none | Low |
| `ui/tabs.tsx` | Tabs (@base-ui) | RETAIN | same | none | Low |
| `ui/progress.tsx` | Progress (@base-ui) | RETAIN | same | none | Low |
| `ui/scroll-area.tsx` | ScrollArea (@base-ui) | RETAIN | same | none | Low |
| `ui/separator.tsx` | Separator (@base-ui) | RETAIN | same | none | Low |
| `ui/tooltip.tsx` | Tooltip (@base-ui) + root TooltipProvider | RETAIN | same | none | Low |
| `ui/card.tsx` | shadcn Card — **never imported anywhere** | DEPRECATE | — | delete in a later task (not Task 001) | None |
| `ui/dialog.tsx` | shadcn Dialog — **never imported anywhere** | OPTIONAL | keep for future modals (settings/profile pickers) | none | None |

### 1.4 Library — `src/lib/`

| File | Functionality | Class | New destination | Required changes | Risk |
| --- | --- | --- | --- | --- | --- |
| `document-parser.ts` | mammoth DOCX + pdf-parse v2 text extraction, counts | **RETAIN** | `src/lib/document-parser.ts` | none (pure, dependency-light) | Low |
| `file-utils.ts` | 10 MB / extension validation, formatting | RETAIN | same | none | Low |
| `docx-generator.ts` | Plain text → DOCX (`docx` lib) | RETAIN | same | none | Low |
| `pdf-report-generator.ts` | jsPDF A4 analysis report | RETAIN | same | rebrand strings ("DocCheck AI" → "Humanly AI"); optional-section guards | Low |
| `grammar-engine.ts` | Chunked LanguageTool client w/ retries + offset mapping | **REFACTOR** | logic moves toward AI service (`/api/v1/grammar/check`) with local/self-hosted LanguageTool options; offset mapping stays client-side or in Next API | Remove hardcoded cloud default → configurable local/self-hosted/hosted; keep chunking + retry patterns | **Medium** — grammar quality must not regress |
| `plagiarism-service.ts` | PrepostSEO client (hardcoded URL, 2 000-word chunks) | **OPTIONAL** | keep as optional integration behind a settings flag | Configurable base URL; must not run by default in a local-first product; external egress must be user-opt-in | Medium (privacy) |
| `ai-detection-service.ts` | ai-checker.co client (hardcoded default URL, score-extraction heuristics) | **OPTIONAL** (or REPLACE with local heuristic later) | optional integration; local alternative is a future model-based check | Same egress opt-in treatment | Medium (privacy) |
| `db.ts` | All Supabase table CRUD via service-role client | **REPLACE** | `src/lib/db.ts` rewritten over Prisma/SQLite | Full rewrite of every function; new entities (sessions, versions, profiles, preferences, settings) added | **HIGH** — every API route depends on it |
| `supabase/admin.ts` | Service-role client, bucket ensure, path sanitize, upload/download | **REPLACE** | `src/lib/storage.ts` (local filesystem: `originals/` + `processed/`) | Implement `safeSegment`-style path safety + `uploadToBucket`/`downloadFromBucket` equivalents over `fs` | Medium — path traversal and filename safety must be preserved |
| `supabase/client.ts` | Browser Supabase client — **never imported** | DEPRECATE | — | delete in a later task | None |
| `supabase/server.ts` | Server Supabase client — **never imported** | DEPRECATE | — | delete in a later task | None |
| `utils.ts` | `cn` re-export | RETAIN | same | none | Low |
| `src/types/index.ts` | Shared domain types (Document, Issue, AnalysisResult, service interfaces) | REFACTOR | same file, extended | Rewrite `Document` to Prisma shape; add RewriteSession/Version, Profile, ModelPreference, Setting; **pages must import from here instead of re-declaring inline copies** | Medium — type drift is an existing bug source |
| `src/proxy.ts` | Next 16 proxy: Supabase session refresh (result unused) | REFACTOR | `src/proxy.ts` | Remove Supabase; become the auth/validation boundary for Humanly AI (or drop if no auth yet); matcher kept | Low-Medium |

### 1.5 Data & config

| File | Contents | Class | New destination | Required changes | Risk |
| --- | --- | --- | --- | --- | --- |
| `supabase/migrations/001_initial_schema.sql` | documents/analyses/reports tables, permissive RLS, 2 buckets | **REPLACE** (kept as historical reference) | `prisma/schema.prisma` (see `ARCHITECTURE.md` §3) | SQLite + Prisma; no RLS concept — authorization moves into the app API | **HIGH** — data migration of existing rows, if any, must be planned in Task 002 |
| `package.json` | deps/scripts | REFACTOR | same | Add: `prisma`, `@prisma/client`, `@tiptap/react` (+ starter/extensions). Remove (later tasks): `@supabase/*`, `mammoth`/`pdf-parse` **only if** parsing moves (default: keep). Scripts: `db:migrate`, `db:seed` | Medium — dependency churn |
| `next.config.ts` | empty | RETAIN | same | Possibly add `serverExternalPackages` for native deps later | Low |
| `tsconfig.json` | strict, `@/*` alias | RETAIN | same | none | Low |
| `components.json` | shadcn base-nova config | RETAIN | same | none (Tiptap components added manually) | Low |
| `eslint.config.mjs`, `postcss.config.mjs` | lint + Tailwind 4 postcss | RETAIN | same | none | Low |
| `.gitignore` | ignores `.env*`, `.next`, etc. | REFACTOR | same | Add `*.db`, `storage/originals/`, `storage/processed/`, `prisma/*.db` | Low |
| `AGENTS.md` / `CLAUDE.md` | Next 16 agent rules pointer | RETAIN | same | none | Low |
| `README.md` | create-next-app boilerplate (misleading) | REPLACE | rewritten README for Humanly AI | Document actual stack, local-first setup, Ollama prerequisites | Low |
| `public/*` | Default create-next-app SVGs | DEPRECATE | new brand assets | Replace later | Low |
| `supabase/` (whole dir) | migrations only | DEPRECATE (after migration) | keep until SQLite cutover verified | Do not delete until data migration is done | — |
| Tests / CI | **Do not exist** | CREATE (Task 002+) | `tests/`, `.github/workflows/` | Establish baseline before refactoring | **HIGH risk amplifier** — no regression safety net today |

---

## 2. Priority classification summary

### RETAIN (8) — minimal or no change
`document-parser.ts` · `file-utils.ts` · `docx-generator.ts` · `pdf-report-generator.ts`
(rebrand strings) · `results/[id]/page.tsx` · `report/[id]/page.tsx` (presentational) ·
`Animated*` components · `ui/*` (except card/dialog) · `globals.css` · `template.tsx` ·
`Header.tsx` · `utils.ts` · config files.

### REFACTOR (9) — useful, architectural change needed
`db.ts` (→ Prisma) · `supabase/admin.ts` (→ local storage) · `upload/route.ts` (split +
async) · `correct/route.ts` · `report/route.ts` · `download/[id]/route.ts` (split + auth) ·
`grammar-engine.ts` (→ AI service contract) · `Sidebar.tsx` · `layout.tsx` · `page.tsx` ·
`upload/page.tsx` · `dashboard/[id]/page.tsx` · `src/types/index.ts` · `proxy.ts` ·
`package.json` · `.gitignore`.

### REPLACE (3)
Editor core (`editor/[id]/page.tsx` `<textarea>` → Tiptap) · Supabase persistence layer
(`001_initial_schema.sql` → `prisma/schema.prisma`) · README.md.

### OPTIONAL (2)
`plagiarism-service.ts` (PrepostSEO) · `ai-detection-service.ts` (ai-checker.co) — both
become explicitly user-enabled integrations; off by default under local-first policy.
`ui/dialog.tsx` kept for future use.

### DEPRECATE (4)
`supabase/client.ts` (unused) · `supabase/server.ts` (unused) · `ui/card.tsx` (unused) ·
default `public/*.svg` assets. **Not to be deleted in Task 001** — flagged for a later
cleanup task.

---

## 3. Special attention items (as required by the brief)

| Item | Finding | Disposition |
| --- | --- | --- |
| **Sidebar** | Collapsible, doc-scoped links resolved from URL or `doccheck:last-document` localStorage key; no auth | REFACTOR — rebrand, new nav model, key rename |
| **Header** | Pure pathname breadcrumb | RETAIN |
| **Dashboard** | Fetches `{document, analysis}` from `/api/download/{id}`; inline duplicate types; optional-integration panels | REFACTOR |
| **Upload page** | Solid UX (XHR progress, validation), but server handler is a synchronous monolith | REFACTOR (client + server) |
| **Document editor** | `<textarea>` with offset-based issue location (`locateIssue` falls back to `indexOf` — can match the wrong occurrence after edits); client-side undo stack; no Tiptap | **REPLACE** with Tiptap; keeps toolbar/panel UX patterns |
| **Correction interface** | Apply-one/apply-all/undo/reset + corrections replay on server (`correct/route.ts` second branch) | REFACTOR — offset replay logic retires once Tiptap positions own the state |
| **Document parser** | mammoth + pdf-parse v2, pure functions, no network | **RETAIN** as-is |
| **DOCX generator** | Plain-text paragraphs only (formatting of original DOCX is lost by mammoth extraction anyway) | RETAIN |
| **PDF report generator** | Self-contained jsPDF layout | RETAIN (+ rebrand) |
| **Grammar engine** | Chunks at 12 000 chars, sequential calls, retries, offset-preserving mapping; hardcoded cloud default | REFACTOR → local/self-hosted/hosted LanguageTool options behind the AI service |

---

## 4. Migration risks (ranked)

1. **No tests / no CI** — every refactor is unguarded. Mitigation: write characterization
   tests for parser, correction-replay, and export generators *before* changing them
   (Task 002).
2. **`/api/download/[id]` shape is load-bearing** — four pages consume it. Splitting it
   must be done in one atomic change or behind a compatibility shim.
3. **Upload becomes async** — current UX assumes one blocking request; background analysis
   needs status polling (the `status` lifecycle column already exists and can drive it).
4. **Supabase → SQLite data cutover** — unknown whether production data exists (live
   project not inspectable). Export path must be defined before Supabase is decommissioned.
5. **External API egress** — plagiarism/AI-detection defaults must flip to opt-in, or the
   local-first promise is broken from day one.
6. **Grammar parity** — local LanguageTool/self-hosted results will differ from the public
   API (rule sets, languages); issue offsets must stay consistent with editor decorations.
7. **Offset-drift bug class** — exists today in both `correct/route.ts` and the editor;
   Tiptap replacement removes it only if corrections are anchored to positions, not strings.
8. **Service-role habit** — the codebase's "admin client everywhere" pattern must not
   carry over into the Prisma layer (no god-mode helpers without an authorization story).
