# DocCheck AI — Repository Architecture & Humanly AI Target Architecture

> Status: Task 001 audit document. Reflects the actual source code as of commit `e329ab0`
> ("feat: integrate PrepostSEO plagiarism and AI detection APIs"). Nothing in this document
> has been implemented yet — it records the as-is state and the approved target state.

---

## Part 1 — Existing repository architecture (as-is)

### 1.1 Technology stack (verified from `package.json` + `package-lock.json`)

| Layer | Technology | Locked version |
| --- | --- | --- |
| Framework | Next.js (App Router) | 16.3.5 |
| UI library | React / React DOM | 19.2.8 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS 4 (CSS-first config, `@theme inline`) | 4.3.3 |
| Component kit | shadcn/ui, style `base-nova`, primitives from `@base-ui/react` | shadcn 4.21.0, @base-ui/react 1.8.0 |
| Animation | `motion` (imported as `motion/react`) | 13.4.0 |
| Icons | lucide-react | 1.47.0 |
| Upload | react-dropzone | 20.1.2 |
| DOCX parsing | mammoth | 1.12.3 |
| PDF parsing | pdf-parse (v2 API: `new PDFParse({ data })`) | 2.4.5 |
| DOCX generation | docx | 9.7.1 |
| PDF report generation | jspdf | 4.2.1 |
| Database (today) | Supabase (PostgreSQL + Storage), `@supabase/supabase-js` + `@supabase/ssr` | 2.117.0 / 0.12.7 |
| IDs | uuid (v4) | 14.0.2 |
| Lint | ESLint 9 + eslint-config-next | — |

Notable configuration facts:

- `next.config.ts` is empty (no custom config).
- `tsconfig.json` is strict; path alias `@/* → ./src/*`.
- `src/app/globals.css` is Tailwind 4 CSS-first — no `tailwind.config.*` file exists.
- `components.json` declares shadcn style `base-nova`, CSS at `src/app/globals.css`.
- **No tests** exist anywhere (`*.test.*`, `*.spec.*`, jest/vitest configs: none).
- **No CI** (`.github/` absent). Scripts are only `dev`, `build`, `start`, `lint`.
- **No `docs/` directory existed** before this task.
- `node_modules` is not installed in the audit environment (see §5 Verification limits).

### 1.2 Route inventory

Pages (all client components except the root layout):

| Route | File | Role |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Marketing/landing page (DocCheck AI branding) |
| `/upload` | `src/app/upload/page.tsx` | Drag & drop DOCX/PDF upload with XHR progress |
| `/dashboard/[id]` | `src/app/dashboard/[id]/page.tsx` | Stats cards, issue list with type filters, plagiarism/AI panels |
| `/editor/[id]` | `src/app/editor/[id]/page.tsx` | Split view: read-only original, `<textarea>` edit pane, correction panel, undo/reset/apply-all, download revised |
| `/report/[id]` | `src/app/report/[id]/page.tsx` | HTML view of analysis report + PDF download |
| `/results/[id]` | `src/app/results/[id]/page.tsx` | Post-analysis summary + download DOCX/PDF |
| layout | `src/app/layout.tsx` | Root layout: Sidebar + Header + TooltipProvider, Geist fonts |
| template | `src/app/template.tsx` | Page transition animations (AnimatePresence) + persists last document ID to `localStorage` |

API route handlers:

| Endpoint | File | Responsibility |
| --- | --- | --- |
| `POST /api/upload` | `src/app/api/upload/route.ts` | Validate → parse → store original → create document row → grammar + plagiarism + AI detection → store analysis → return result (all synchronous in one request) |
| `POST /api/correct` | `src/app/api/correct/route.ts` | Build corrected text (editor flow or re-apply stored corrections) → generate revised DOCX → store in Supabase → patch analysis → return DOCX bytes |
| `POST /api/report` | `src/app/api/report/route.ts` | Generate PDF report (jsPDF) → store in Supabase → insert report row → return PDF bytes |
| `GET /api/download/[id]` | `src/app/api/download/[id]/route.ts` | With `?type=original|revised|report`: stream file from Supabase Storage; without: return `{ document, analysis }` JSON (used by all detail pages) |

Request middleware: `src/proxy.ts` — this is the **Next.js 16 `proxy.ts` convention**
(middleware was renamed to `proxy` in Next 16; verified against the official `proxy.js`
file-convention docs). It creates a Supabase SSR server client and calls
`supabase.auth.getUser()` when env vars are present, but **the result is never used** and
no route is guarded. Matcher excludes static assets.

### 1.3 Library layer (`src/lib/`)

| File | What it actually does | External calls |
| --- | --- | --- |
| `document-parser.ts` | `parseDocx` (mammoth raw text), `parsePdf` (pdf-parse v2), word/char/paragraph counts | none |
| `grammar-engine.ts` | `analyzeText()`: splits text into ≤12 000-char chunks, calls LanguageTool `/v2/check` **sequentially** with exponential backoff (3 retries), maps category IDs to `Issue["type"]`, preserves offsets | LanguageTool (default `https://api.languagetool.org/v2/check`, override via env `Languagetool_API_URL` — note the irregular casing) |
| `plagiarism-service.ts` | `check()`: splits by 2 000 words, parallel chunk calls, weighted plagiarism score, top-20 sources | PrepostSEO — **hardcoded** `https://www.prepostseo.com/apis/checkPlag`; requires `PREPOSTSEO_API_KEY`; degrades to `not_checked` without key |
| `ai-detection-service.ts` | `detect()`: 9 000-char chunks, parallel calls, extracts score from many possible response shapes, averages chunk scores | ai-checker.co — **hardcoded default** `https://api.ai-checker.co/v1/detect` (overridable via `AI_DETECTION_API_URL`), optional `AI_DETECTION_API_KEY` |
| `docx-generator.ts` | Plain-text → DOCX (Calibri 12pt paragraphs) via `docx`; `_revised` filename helper | none |
| `pdf-report-generator.ts` | jsPDF A4 report: doc info, stats, issue summary, plagiarism/AI sections, detailed findings, corrections log | none |
| `file-utils.ts` | 10 MB limit, `.docx`/`.pdf` extension allowlist, size formatting | none |
| `db.ts` | All Supabase table access: `createDocument`, `updateDocument`, `getDocument(WithAnalysis)`, `upsertAnalysis`, `patchAnalysis`, `getAnalysisByDocument`, `createReport`, `getLatestReport` — **every function uses `requireAdmin()`** | Supabase Postgres |
| `supabase/admin.ts` | Service-role client factory (`requireAdmin`), `ensureStorageBuckets`, `safeSegment` (path sanitization), `uploadToBucket`, `downloadFromBucket` | Supabase Storage |
| `supabase/client.ts` | Browser client factory — **never imported anywhere** | — |
| `supabase/server.ts` | Server client factory (cookies) — **never imported anywhere** | — |
| `utils.ts` | Re-exports `cn` from the `cn` package | — |

### 1.4 Data model (as implemented in `supabase/migrations/001_initial_schema.sql`)

Three PostgreSQL tables (JSONB for issues/corrections), RLS **enabled** but with
`FOR ALL USING (true)` policies — explicitly commented *"allow all for MVP - add auth later"*:

- `documents` — file metadata, storage paths, extracted text, counts, status lifecycle
  (`uploaded → parsing → parsed → analyzing → analyzed → correcting → corrected`).
- `analyses` — 1:1 with document (`document_id` UNIQUE), issue counters, plagiarism/AI
  scores + statuses, `issues JSONB`, `corrections_applied JSONB`.
- `reports` — one row per generated PDF, FK to document and analysis.

Two private Storage buckets are provisioned idempotently: `documents`, `reports`.

### 1.5 Current request flow (upload → analysis → correct → report)

```text
Browser                     Next.js API (Node)                    External services
──────                      ──────────────────                    ─────────────────
POST /api/upload ─────────► validate ext + 10 MB
  (multipart file)          parseDocument (mammoth/pdf-parse)
                            upload original → Supabase Storage
                            insert documents row
                            analyzeText ────────────────────────► LanguageTool (cloud, chunked)
                            plagiarism check ───────────────────► PrepostSEO (chunked)
                            AI detection ───────────────────────► ai-checker.co (chunked)
                            upsert analyses row, status=analyzed
  ◄──── { document, analysis }

GET /api/download/{id} ◄─── select via service-role client (no auth check)

POST /api/correct ────────► rebuild corrected text (editor or replay)
                            generateRevisedDocx (docx lib)
                            upload revised → Supabase Storage
  ◄──── DOCX bytes          patch analyses.corrections_applied

POST /api/report ─────────► generateReportPdf (jsPDF)
                            upload → reports bucket, insert reports row
  ◄──── PDF bytes
```

### 1.6 Environment variables referenced by code

Documented by name only — no values are stored in this repository (`.env*` is gitignored;
no `.env` file exists in the working tree):

| Variable | Required? | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes (all DB/storage paths) | `supabase/admin.ts`, `client.ts`, `server.ts`, `proxy.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (proxy/server/browser clients) | `client.ts`, `server.ts`, `proxy.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (all actual data access) | `supabase/admin.ts` |
| `PREPOSTSEO_API_KEY` | optional (feature degrades to `not_checked`) | `plagiarism-service.ts` |
| `AI_DETECTION_API_KEY` | optional | `ai-detection-service.ts` |
| `AI_DETECTION_API_URL` | optional (defaults to hardcoded ai-checker.co URL) | `ai-detection-service.ts` |
| `Languagetool_API_URL` | optional (defaults to api.languagetool.org) | `grammar-engine.ts` |

### 1.7 Security posture (as-is)

1. **No authentication anywhere.** No sign-in UI, no session checks, no ownership column.
   Every data access goes through the **service-role** Supabase client, which bypasses RLS
   entirely; the `FOR ALL USING (true)` policies are therefore both permissive and moot.
2. **No document ownership checks.** `GET /api/download/{id}`, `POST /api/correct` and
   `POST /api/report` operate on any UUID they are given. IDs are v4 (unguessable in
   practice) but there is zero authorization beyond that.
3. **Administrative (service-role) access is used for ordinary user operations** —
   `requireAdmin()` in `db.ts` and every API route. This is the single highest-risk pattern
   in the codebase: a leak of `SUPABASE_SERVICE_ROLE_KEY` compromises the whole database.
4. **Document content leaves the machine by default** — full extracted text is sent to
   LanguageTool (public cloud), PrepostSEO and ai-checker.co. This directly conflicts with
   the local-first direction of Humanly AI.
5. **Hardcoded third-party endpoints** in `plagiarism-service.ts` and
   `ai-detection-service.ts` (one overridable, one not).
6. **`Content-Disposition` filename construction** uses raw `document.file_name` in the
   download route (the other routes derive names from it). `safeSegment()` strips slashes
   and control characters for *storage paths* but not quotes, so a crafted filename with a
   `"` could break/inject response headers. Fix during migration.
7. **No rate limiting** on any route; `/api/upload` performs grammar + plagiarism + AI
   detection synchronously in one HTTP request (timeout risk on large documents; the
   `parsing`/`analyzing` UI states are declared but never actually set).
8. **`proxy.ts` calls `supabase.auth.getUser()` but ignores the result** — dead auth code
   that could create a false sense of protection.
9. **Duplicate/divergent type definitions**: `Issue`, `DocumentData`, `AnalysisData` are
   re-declared inline in `dashboard`, `editor`, `report`, `results` pages instead of using
   `src/types/index.ts` — drift risk.
10. **No tests, no CI, README is unchanged create-next-app boilerplate** (it does not
    describe the actual application at all).

---

## Part 2 — Humanly AI target architecture (approved, not yet implemented)

### 2.1 Product direction

Local-first AI writing intelligence platform. All heavy AI processing runs on the user's
machine via Ollama; the application never depends on public AI APIs.

### 2.2 Stack

| Layer | Technology | Relation to current repo |
| --- | --- | --- |
| Frontend + app backend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Motion, **Tiptap** | Already in place (Next 16.3.5, React 19.2.8, Tailwind 4.3.3, shadcn base-nova, motion 13.4.0). **Tiptap is new** — replaces the `<textarea>` editor. |
| AI service | Python + FastAPI + Pydantic + Ollama integration | New — does not exist yet |
| AI models | Primary: **Qwen3 4B**; Secondary: **Gemma 3 4B**; Future: fine-tuned open-weight writing model | New (see `MODEL_SELECTION.md`) |
| Database | **SQLite via Prisma**, owned exclusively by Next.js | Replaces Supabase PostgreSQL |
| Storage | **Local filesystem**, separate `originals/` and `processed/` directories | Replaces Supabase Storage |
| Grammar | Local processing; optional self-hosted LanguageTool; optional hosted LanguageTool | Replaces the hardcoded public LanguageTool call |

Hard constraints (approved):

- Next.js owns all application persistence.
- The Python FastAPI service is **stateless** and must **never** open or modify the SQLite
  database directly.
- Ollama and FastAPI are **never** exposed to the public internet — only Next.js talks to
  FastAPI, and FastAPI talks to Ollama on loopback.

### 2.3 Service responsibilities

```text
┌──────────────────────────────────────────────────────────────────┐
│ Next.js (public edge)                                            │
│  • UI: upload, writing workspace, Tiptap editor, settings        │
│  • Application API: documents, rewrite sessions/versions,        │
│    writing profiles, model preferences, settings, history,       │
│    validation                                                    │
│  • Owns SQLite (Prisma) and local file storage                   │
│  • Sole caller of the AI service                                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP over loopback / private network
                             │ (service token, never public)
┌────────────────────────────▼─────────────────────────────────────┐
│ Python FastAPI (stateless)                                       │
│  • AI rewriting, grammar assistance, writing analysis            │
│  • Model orchestration (Ollama), output quality verification     │
│  • No database, no filesystem persistence, no session state      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ loopback only
┌────────────────────────────▼─────────────────────────────────────┐
│ Ollama — local inference (Qwen3 4B / Gemma 3 4B)                 │
└──────────────────────────────────────────────────────────────────┘
```

Layer rules:

| Layer | Owns | Must not do |
| --- | --- | --- |
| Next.js frontend | UI, editor, upload, workspace | talk to Ollama/FastAPI directly from the browser |
| Next.js application API | SQLite persistence, settings, history, validation, proxying AI calls | expose raw model access; trust client-supplied scores |
| Python FastAPI | AI rewriting, grammar assist, analysis, orchestration, output verification | read/write SQLite; persist files; accept public traffic |
| Ollama | Inference | listen on non-loopback interfaces |

---

## Part 3 — Database architecture (Prisma / SQLite, proposed)

Designed for Task 002+. Single SQLite database; **no second database for Python**.
Covers the six required entities: documents, rewrite sessions, rewrite versions,
writing profiles, model preferences, application settings.

```prisma
// prisma/schema.prisma (PROPOSED — not yet created)
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")   // e.g. file:./humanly.db
}

model Document {
  id              String   @id @default(uuid())
  fileName        String
  fileType        String   // "docx" | "pdf"
  fileSize        Int
  originalPath    String   // storage/originals/<id>/<file>
  processedPath   String?  // storage/processed/<id>/<file>
  extractedText   String   @default("")
  wordCount       Int      @default(0)
  charCount       Int      @default(0)
  paragraphCount  Int      @default(0)
  status          String   @default("uploaded")
  // uploaded | parsing | parsed | analyzing | analyzed | correcting | corrected
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  sessions        RewriteSession[]
  profileId       String?
  profile         WritingProfile? @relation(fields: [profileId], references: [id])
}

model RewriteSession {
  id            String   @id @default(uuid())
  documentId    String
  document      Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  mode          String   // "full" | "selection" | "grammar" | "analysis"
  sourceText    String
  profileId     String?
  profile       WritingProfile? @relation(fields: [profileId], references: [id])
  modelUsed     String?             // e.g. "qwen3:4b"
  createdAt     DateTime @default(now())

  versions      RewriteVersion[]
}

model RewriteVersion {
  id            String   @id @default(uuid())
  sessionId     String
  session       RewriteSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  versionIndex  Int               // 0-based position in the session
  rewrittenText String
  isApplied     Boolean  @default(false)
  qualityScore  Float?            // output-verification score from the AI service
  createdAt     DateTime @default(now())

  @@unique([sessionId, versionIndex])
}

model WritingProfile {
  id            String   @id @default(uuid())
  name          String   @unique
  tone          String?             // e.g. "formal", "concise"
  audience      String?
  styleRules    String? @default("") // free-form instructions
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  documents     Document[]
  sessions      RewriteSession[]
}

model ModelPreference {
  id            String   @id @default(uuid())
  key           String   @unique   // e.g. "primary", "secondary", "grammar"
  modelTag      String              // Ollama tag, e.g. "qwen3:4b"
  updatedAt     DateTime @updatedAt
}

model ApplicationSetting {
  key           String   @id
  value         String              // JSON-encoded value
  updatedAt     DateTime @updatedAt
}
```

Mapping notes:

- Supabase `analyses.issues` / `corrections_applied` JSONB → for Task 001 scope they map
  onto rewrite history (`RewriteSession`/`RewriteVersion`) plus derived counters; a
  decision on persisting per-issue grammar results as structured rows vs. JSON is deferred
  to Task 002.
- Supabase `reports` table → folded into `Document.processedPath` (latest generated file)
  unless report history is explicitly required later.
- `Document` gains an optional `profileId` so writing profiles attach to documents; there
  is intentionally **no user/ownership table yet** — authentication is out of Task 001 scope
  and must be re-examined before any multi-user deployment (see `DEVELOPMENT_ROADMAP.md`).

---

## Part 4 — What could not be verified (audit limits)

1. **Build/lint were not run.** `node_modules` is not installed and installing packages is
   outside Task 001 restrictions. Static inspection only; `npm run build` may surface issues
   not visible in source (e.g. Next 16 type-generation requirements).
2. **The live Supabase project was not inspected** — no credentials exist in the working
   tree. The schema described here comes solely from `001_initial_schema.sql`; the actual
   remote database may differ (applied migrations, extra tables/policies).
3. **Runtime behavior of external APIs** (LanguageTool, PrepostSEO, ai-checker.co) was not
   exercised; response-shape handling (especially the score-extraction heuristics in
   `ai-detection-service.ts`) is inferred from code, not from live responses.
4. **`README.md` was deliberately not trusted** — it is unchanged create-next-app boilerplate
   and describes none of the actual features.
5. **Ollama/Qwen3/Gemma were not downloaded or benchmarked** (prohibited in Task 001) —
   see `MODEL_SELECTION.md` for the evaluation plan.
6. **No tests exist**, so no behavioral baseline could be captured. Regression risk for
   Task 002+ is therefore higher than the file inventory alone suggests.
