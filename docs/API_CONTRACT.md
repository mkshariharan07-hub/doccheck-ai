# Humanly AI — AI Service API Contract

> Task 001 deliverable. **Proposed contract only — no endpoints have been implemented.**
> These are **Python FastAPI service** endpoints (not Next.js routes). Next.js is the only
> permitted caller. The FastAPI service is stateless: it never touches SQLite, never
> persists files, and holds no session state between requests.

---

## 1. Transport & security rules

| Rule | Value |
| --- | --- |
| Base URL (dev) | `http://127.0.0.1:8000` (loopback only) |
| Base URL (deployed) | Private network / Unix socket behind Next.js — **never public** |
| Caller | Next.js application API only (browser → FastAPI is forbidden) |
| Auth | Shared service token via `Authorization: Bearer <token>`; token configured in Next.js env and FastAPI env, never committed |
| Ollama | FastAPI → `http://127.0.0.1:11434` (loopback only); Ollama itself never exposed |
| Database | **None** — FastAPI must not open the SQLite file |
| Persistence | None — request in, response out; history/versions are written by Next.js |
| Content type | `application/json` (UTF-8) |
| Errors | RFC 7807-style `{ "detail": ..., "code": ... }` with proper HTTP status |
| Timeouts | Next.js enforces per-request timeouts (proposed: rewrite 60 s, grammar/analysis 30 s, health 5 s) and degrades gracefully (see §4) |

Every text-bearing request includes a `language` hint (BCP-47, default `en-US`) — the
incumbent `grammar-engine.ts` already takes `language` and this must not be lost.

---

## 2. Common schemas (Pydantic, proposed)

```text
RewriteRequest
  text            : string          # full text, or the selected span for /rewrite/selection
  mode            : "full" | "paragraph" | "selection" | "grammar" | "analysis"
  profile?        : { tone?, audience?, styleRules? }   # writing profile, passed by value
  model?          : string          # Ollama tag override; defaults to configured primary
  temperature?    : number (0..2)   # default per-mode
  variations?     : int (1..5)      # only for /rewrite/variations
  language?       : string          # default "en-US"

RewriteResult
  text            : string
  model           : string          # tag actually used
  confidence?     : number (0..1)   # from the verification pass
  changes?        : [ { original, replacement, offset, reason? } ]
  latencyMs       : int

GrammarIssue                          # mirrors the existing Issue shape
  id              : string
  originalText    : string
  startOffset     : int              # relative to the submitted text
  endOffset       : int
  type            : "grammar" | "spelling" | "punctuation" | "style"
  message         : string
  suggestedFix?   : string | null
  ruleId?         : string
  category?       : string

AnalysisResult
  summary         : string
  scores          : { clarity?, coherence?, tone?, correctness? }   # 0..100
  issues?         : [ GrammarIssue ]
  suggestions?    : [ string ]

EvaluationResult
  accepted        : boolean
  score           : number (0..1)
  problems?       : [ string ]
  revisedText?    : string          # only if the verifier repairs the output
```

Offset convention: `startOffset`/`endOffset` are **character offsets into the exact text
string that was submitted**, matching the existing `Issue` contract in
`src/types/index.ts` — the editor's decoration logic depends on this.

---

## 3. Endpoints

### 3.1 `POST /api/v1/rewrite`
Full/paragraph rewrite conditioned on the writing profile.

```json
// request
{ "text": "…", "mode": "full", "profile": { "tone": "formal", "audience": "executives" },
  "language": "en-US" }
// 200 → RewriteResult
```
Next.js use: writing workspace "Rewrite" action → creates a `RewriteSession` +
`RewriteVersion`, persists via Prisma, returns text to the editor.

### 3.2 `POST /api/v1/rewrite/variations`
Generates N ranked alternatives from one request (single model load, batched sampling).

```json
{ "text": "…", "mode": "paragraph", "variations": 3, "temperature": 0.9 }
// 200 → { "variations": [ RewriteResult… ] }   // ordered by verification score, best first
```
Next.js use: "Show alternatives" UI; each chosen variation stored as a new
`RewriteVersion.versionIndex`.

### 3.3 `POST /api/v1/rewrite/selection`
Rewrites only the user-selected span (smallest context → best quality and lowest latency).

```json
{ "text": "selected span only", "mode": "selection",
  "contextBefore": "optional…", "contextAfter": "optional…",
  "profile": { "tone": "concise" } }
// 200 → RewriteResult
```
`contextBefore`/`contextAfter` (optional, capped) give the model surrounding context
without sending the whole document.

### 3.4 `POST /api/v1/grammar/check`
Rule-based or model-based grammar check (see `MODEL_SELECTION.md` §5).

```json
{ "text": "…", "language": "en-US", "engine": "model" | "languagetool" }
// 200 → { "issues": [ GrammarIssue… ], "engine": "model", "chunks": 1 }
```
`engine` selects the configured default when omitted. The response shape is
deliberately identical to today's `analyzeText()` output so the dashboard/editor/
report consumers do not change shape.

### 3.5 `POST /api/v1/analysis`
Writing analysis (structure, tone, quality) — replaces the non-grammar half of the
current upload-time analysis.

```json
{ "text": "…", "mode": "analysis", "language": "en-US" }
// 200 → AnalysisResult
```
Next.js use: dashboard "writing analysis" panel; runs asynchronously after upload.

### 3.6 `POST /api/v1/evaluation`
Output quality verification — the guardrail step. Called by Next.js (or internally by
the rewrite endpoints when `verify: true`).

```json
{ "original": "…", "rewritten": "…", "profile": { "tone": "formal" } }
// 200 → EvaluationResult
```
Rejects rewrites that change facts/numbers, drift from the profile, or degrade grammar.
`accepted=false` → Next.js does not store the version as applied and offers a retry.

### 3.7 `GET /api/v1/models`
```json
// 200
{ "primary": "qwen3:4b", "secondary": "gemma3:4b",
  "available": [ { "tag": "qwen3:4b", "loaded": true, "sizeBytes": … }, … ] }
```
Next.js use: settings page model picker (values persisted to `ModelPreference`).

### 3.8 `GET /api/v1/health`
```json
// 200  → { "status": "ok", "ollama": "reachable", "modelsLoaded": 2, "latencyMs": 12 }
// 503  → { "status": "degraded", "ollama": "unreachable", … }
```
Next.js use: startup check + UI badge ("AI service offline" state) + Task 002 smoke test.

---

## 4. How Next.js communicates with the AI service

```text
Browser ──► Next.js application API ──► Python FastAPI ──► Ollama
             (auth, validation,        (stateless AI       (inference)
              SQLite via Prisma,         only)
              local storage)
```

Responsibilities at the Next.js boundary:

1. **Authenticate the user** and validate input (this is where authorization lives —
   the FastAPI service trusts only Next.js).
2. **Persist** everything (sessions, versions, applied flags) via Prisma — FastAPI returns
   data, never writes it.
3. **Call FastAPI** server-side with `fetch`/undici using `AI_SERVICE_URL` +
   `AI_SERVICE_TOKEN` (env names, values never committed). The browser never sees these.
4. **Degrade gracefully**: on FastAPI/Ollama unavailability, app API returns a typed
   error the UI shows as "AI service offline — grammar/export still work"; the existing
   `not_checked` status pattern from the current services is the precedent.
5. **Timeouts + retries**: one retry with backoff for idempotent GETs; **no automatic
   retry** for rewrite POSTs (non-idempotent — a duplicate would double-store versions;
   the UI offers an explicit retry instead).

Proposed Next.js app-API surface that fronts this contract (for Task 002 planning —
these are Next.js routes, not FastAPI routes):

| Next.js route | Proxies to |
| --- | --- |
| `POST /api/workspace/[id]/rewrite` | `/api/v1/rewrite` (+ `/variations`, `/selection`) |
| `POST /api/workspace/[id]/grammar` | `/api/v1/grammar/check` |
| `POST /api/workspace/[id]/analysis` | `/api/v1/analysis` |
| `POST /api/workspace/[id]/evaluate` | `/api/v1/evaluation` |
| `GET /api/settings/models` | `/api/v1/models` (cached) |
| `GET /api/health/ai` | `/api/v1/health` |

---

## 5. Explicit non-goals for this contract

- **No database access** for FastAPI (single SQLite owned by Next.js; no second DB).
- **No file upload/download** through FastAPI — documents stay in Next.js storage
  (`originals/` + `processed/`); only text payloads cross the service boundary.
- **No public exposure** of FastAPI or Ollama (architecture constraint).
- **No persistence of prompts/outputs** inside FastAPI (history is a Next.js concern,
  stored as `RewriteSession`/`RewriteVersion`).
- Endpoints are **not implemented in Task 001** — this document is the contract to build
  against in Task 002+.
