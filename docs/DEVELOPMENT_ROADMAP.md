# Humanly AI — Development Roadmap

> Task 001 deliverable. Recommended execution sequence for Task 002 onward.
> **No implementation has started. Task 002 requires explicit approval before beginning.**

---

## 0. Ground rules carried forward from Task 001

- Do not delete/move existing components during early tasks — deprecations
  (`supabase/client.ts`, `supabase/server.ts`, `ui/card.tsx`, default `public/*.svg`)
  happen only after the SQLite cutover is verified.
- Supabase stays working until the Prisma path is proven; the migration file
  `001_initial_schema.sql` remains as the schema of record until cutover.
- Ollama and FastAPI stay on loopback; never public.
- No secrets in any committed file (env names only).
- Every task ends with `npm run lint` + `npm run build` passing (note: `node_modules` is
  currently not installed — Task 002 starts with `npm ci`).

---

## 1. Task sequence

### Task 002 — Safety net + project bootstrap *(foundation, no feature work)*
1. `npm ci`; verify `npm run lint` / `npm run build` pass on the current tree (baseline).
2. Add test tooling (Vitest) and **characterization tests** for the pure logic that will
   be refactored later — this is the highest-value insurance in the repo:
   - `document-parser.ts` (DOCX/PDF extraction, counts)
   - correction replay logic in `correct/route.ts` (offset application, descending sort)
   - `file-utils.ts`, `safeSegment`, filename helpers (`getRevisedFileName`, etc.)
   - `grammar-engine.ts` chunking + offset mapping (mock the LanguageTool HTTP call)
3. Prisma bootstrap: `prisma/schema.prisma` per `ARCHITECTURE.md` §3, `DATABASE_URL`
   pointing at a local `humanly.db`, initial migration, seed script.
4. Local storage scaffold: `storage/originals/`, `storage/processed/`, path-safety helper
   (port of `safeSegment`, **plus quote/CRLF stripping** for header safety).
5. CI: GitHub Actions running lint + build + tests (`.github/workflows/ci.yml`).

**Exit criteria**: green baseline test suite; Prisma migrate runs clean; CI green.

### Task 003 — Persistence swap (Supabase → SQLite/Prisma)
1. Rewrite `src/lib/db.ts` over Prisma (same exported function shapes first — minimize
   blast radius — then extend with sessions/versions/profiles/preferences/settings).
2. Replace `supabase/admin.ts` storage calls with local filesystem helpers in
   `src/lib/storage.ts`.
3. Rewrite the four API routes' storage/DB touchpoints (`upload`, `correct`, `report`,
   `download`).
4. Data migration: export any existing Supabase rows → import script → verify counts.
   (Blocked on: confirming whether production data exists — live project not inspectable
   in Task 001.)
5. Remove Supabase env requirements from runtime paths; keep `@supabase/*` installed but
   unreferenced until Task 007 cleanup.

**Exit criteria**: full DocCheck flow (upload → analyze → correct → report → download)
works with zero Supabase dependencies. Characterization tests still green.

### Task 004 — Split and async the upload/analysis pipeline
1. `POST /api/documents` (create + parse + store original, return immediately).
2. Background analysis step (route handler with `waitUntil`/queue, or sequential follow-up
   request) writing through the existing `status` lifecycle (`parsing → analyzing →
   analyzed`), which the UI states already anticipate but never set.
3. Client `upload/page.tsx`: poll status instead of one blocking XHR.
4. Split `GET /api/download/[id]` into `GET /api/documents/[id]` (JSON) and
   `GET /api/documents/[id]/file?type=` (stream) — **single atomic change**, four pages
   updated together. Fix `Content-Disposition` filename sanitization here.

**Exit criteria**: upload responds in <1 s; analysis completes in background; no page
regressions.

### Task 005 — AI service skeleton (Python/FastAPI) + contract implementation
1. `services/ai/` Python project: FastAPI + Pydantic, service-token auth, `/health`,
   `/models` implemented against Ollama; `rewrite`, `rewrite/variations`,
   `rewrite/selection`, `grammar/check`, `analysis`, `evaluation` implemented with a
   stub/mock model first, then real Ollama calls.
2. Ollama setup: pull pinned `qwen3:4b` and `gemma3:4b` tags (approved in
   `MODEL_SELECTION.md`; pin exact tags, never `latest`).
3. Next.js app-API proxy routes per `API_CONTRACT.md` §4 with timeout/degradation
   handling (`AI_SERVICE_URL`, `AI_SERVICE_TOKEN` env).
4. Contract tests: OpenAPI schema snapshot + consumer-side mocks in the Vitest suite.

**Exit criteria**: `GET /api/v1/health` green through Next.js; rewrite round-trip works
end-to-end with Qwen3 4B; graceful "AI service offline" state in the UI.

### Task 006 — Grammar move (local-first)
1. Point `grammar/check` at: (a) model-based (Gemma 3 4B) and/or (b) self-hosted
   LanguageTool, with hosted LanguageTool as **explicit opt-in** (port of
   `grammar-engine.ts` chunking/retry/offset logic).
2. Flip the default: **no automatic cloud egress**. Existing `Languagetool_API_URL`
   behavior becomes the opt-in "hosted" path.
3. Parity check against the golden set (`MODEL_SELECTION.md` §4.6) before switching the
   default engine.

**Exit criteria**: grammar flow works with zero required external network calls.

### Task 007 — Cleanup + deprecations
1. Delete deprecated files: `supabase/client.ts`, `supabase/server.ts`, `ui/card.tsx`
   (only after confirming no references), default `public/*.svg`.
2. Remove `@supabase/*`, and `plagiarism-service`/`ai-detection-service` wiring from the
   default path (keep as OPTIONAL integrations behind settings, **off by default**).
3. Rewrite `README.md` (currently create-next-app boilerplate) for Humanly AI.
4. Remove `supabase/` directory once data migration is confirmed complete.
5. `.gitignore` additions: `*.db`, `storage/originals/`, `storage/processed/`.

**Exit criteria**: `grep -r supabase src/` returns nothing; README describes reality.

### Task 008 — Tiptap editor (the REPLACE task)
1. Introduce Tiptap: rich text workspace replacing the `<textarea>` in
   `editor/[id]/page.tsx` (or the new workspace route).
2. Corrections as **position-anchored decorations** (eliminates the offset-drift /
   `indexOf` wrong-match bug class present in both the editor and `correct/route.ts`).
3. Undo/redo → Tiptap history extension (retires the hand-rolled `histories` stack).
4. Apply-one / apply-all / reset UX ported; corrections persisted as rewrite versions.
5. DOCX export from Tiptap content (extend `docx-generator.ts` beyond plain paragraphs).

**Exit criteria**: full edit → apply → export flow on Tiptap; characterization tests
updated (not weakened).

### Task 009 — Humanly AI shell + writing workspace
1. Rebrand: `layout.tsx` metadata, `page.tsx` copy, `Sidebar` nav (new key
   `humanly:last-document`), `pdf-report-generator.ts` strings.
2. Workspace page combining rewrite actions (full/variations/selection), analysis panel,
   and history (sessions/versions from Prisma).
3. Settings page: model preferences (`ModelPreference`), grammar engine choice,
   optional-integration toggles (plagiarism/AI-detection **off by default**).
4. Writing profiles CRUD (`WritingProfile`) wired into rewrite requests.

**Exit criteria**: product reads as Humanly AI end-to-end; DocCheck flows still pass.

### Task 010+ — Validation & polish
- Run the `MODEL_SELECTION.md` §4 evaluation (golden set, verification thresholds,
  resource measurements) and flip model preferences if measurements disagree with the
  assumed primary.
- `break-ui`/worst-case data pass on the workspace; performance pass on animations;
  accessibility sweep.
- Report/history views; DOCX/PDF export polish; optional integrations enabled-by-user.

---

## 2. Dependency graph (critical path)

```text
002 bootstrap+tests ──► 003 persistence swap ──► 004 async split ──► 008 Tiptap editor ──► 009 shell/workspace ──► 010 validation
                └────────────► 005 AI service skeleton ──► 006 grammar local-first ────────┘
                └────────────► 007 cleanup (after 003 verified)
```

Parallelizable: 005 can start once 002 lands (it does not depend on 003/004);
007 requires 003; 009 requires 004 + 005.

---

## 3. Consolidated risk register

| # | Risk | Sev | Mitigation | Task |
| --- | --- | --- | --- | --- |
| 1 | No tests/CI today — refactors are unguarded | High | Characterization tests before any refactor | 002 |
| 2 | `/api/download/[id]` shape is load-bearing (4 pages) | High | Atomic split + compatibility in one change | 004 |
| 3 | Service-role "admin everywhere" habit carries into Prisma layer | High | Authorization design before new endpoints ship | 002–004 |
| 4 | No auth/ownership exists at all | High | Decide auth model before multi-user/deploy; out of Task 001 scope | 009+ |
| 5 | Unknown production data in Supabase (live project not inspected) | Medium | Export/verify before decommissioning | 003 |
| 6 | Grammar parity: local vs cloud rule sets differ | Medium | Golden-set parity check before default flip | 006 |
| 7 | Offset-drift/wrong-`indexOf` correction bugs (exist today) | Medium | Tiptap position anchoring | 008 |
| 8 | External egress defaults break local-first promise | Medium | Plagiarism/AI-detection opt-in, off by default | 006/007 |
| 9 | Header injection via raw `file_name` in `Content-Disposition` | Medium | Sanitize in download split | 004 |
| 10 | 4B model quality assumptions unvalidated (no benchmarks run) | Medium | Evaluation plan before promoting defaults | 010 |
| 11 | Upload monolith timeouts on large docs | Low-Med | Async pipeline | 004 |
| 12 | Type duplication drift (inline interfaces in 4 pages) | Low | Consolidate on `src/types` | 004/009 |

---

## 4. Definition of done (Task 002 onward, per task)

1. `npm ci && npm run lint && npm run build && npm test` green (from Task 002 on).
2. No secrets in the diff; env vars documented by name only.
3. Docs updated if behavior changed (`ARCHITECTURE.md`, `MIGRATION_MAP.md`,
   `API_CONTRACT.md` as applicable).
4. No Supabase decommissioning before Task 003 exit criteria are met.
5. Explicit approval obtained before starting each new task — **Task 002 has not started.**
