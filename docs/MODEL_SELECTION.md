# Humanly AI — Model Selection

> Task 001 deliverable. Selection is approved at the architecture level: **Qwen3 4B
> (primary)**, **Gemma 3 4B (secondary)**, **fine-tuned open-weight writing model (future)**.
> No models were downloaded, benchmarked, or trained during Task 001 (restricted scope).
> This document records the rationale, the intended roles, and the evaluation plan that
> must run in a later task before the selection is treated as validated.

---

## 1. Selection summary

| Role | Model | Served by | Used for |
| --- | --- | --- | --- |
| Primary | **Qwen3 4B** | Ollama (loopback) | Rewriting, variation generation, writing analysis, selection rewrites |
| Secondary | **Gemma 3 4B** | Ollama (loopback) | Grammar assistance, fallback when primary is busy/unavailable, output-verification cross-check |
| Future | Fine-tuned open-weight writing model | Ollama | Domain/style-specific rewriting once we have a supervised dataset of profile-conditioned rewrites |

Model tags are stored in the `ModelPreference` table (keys `primary`, `secondary`,
`grammar`) so switching models is a settings change, not a code change.

---

## 2. Why these two, at this size

### 2.1 The 4B constraint is deliberate

- **Local-first**: the target user runs Ollama on their own machine. Models in the 4B class
  run on ordinary laptop hardware (memory-footprint class of roughly 3–5 GB at 4-bit
  quantization), which is the practical ceiling for "runs on your machine, no cloud".
- **Latency**: rewriting is an interactive feature. A 4B-class model keeps
  single-paragraph rewrites in the range users will tolerate; larger models push requests
  into multi-second territory without a GPU.
- **Two models, not one**: running a primary + secondary lets us separate concerns
  (creative rewriting vs. conservative grammar/safety checking) and gives us a built-in
  fallback path if one model is unloaded or fails verification.

### 2.2 Qwen3 4B as primary

- Part of a generation explicitly trained for **instruction following and reasoning**, which
  matters for rewrite tasks that must obey a writing profile (tone, audience, style rules)
  rather than just rephrase.
- Strong multilingual coverage, useful because document input is not language-constrained.
- The Qwen line has been widely served via Ollama with tags that make version pinning
  straightforward (pin an exact tag such as `qwen3:4b` — never `latest` — in
  `ModelPreference.modelTag`).

### 2.3 Gemma 3 4B as secondary

- Known for strong **instruction adherence and stylistic control** at small sizes — a good
  match for conservative, minimal-edit grammar assistance where over-rewriting is a defect.
- Provides vendor diversity: two different model families reduce the risk of shared failure
  modes (e.g. a family-specific tendency to hallucinate corrections).
- Serves as the cross-checker in the **output quality verification** step of the AI
  service: rewrite with primary → verify with secondary → reject or flag low-confidence
  outputs.

### 2.4 Why not larger models

| Option | Why rejected for now |
| --- | --- |
| 8B–70B class | Exceeds the "runs on a normal laptop" promise; GPU requirement changes the product |
| Cloud APIs (GPT/Claude/Gemini class) | Contradicts local-first direction and the "never expose data to public AI services" constraint that motivated this migration |
| Single 4B model only | No fallback, no independent verification cross-check |

---

## 3. Task allocation across the AI service

| AI service endpoint | Model | Notes |
| --- | --- | --- |
| `POST /api/v1/rewrite` | Primary (Qwen3 4B) | Full-document / paragraph rewrite conditioned on writing profile |
| `POST /api/v1/rewrite/variations` | Primary | N samples with varied seeds/temperature; ranked by verification step |
| `POST /api/v1/rewrite/selection` | Primary | Rewrite only the selected span (smallest context = best quality) |
| `POST /api/v1/grammar/check` | Secondary (Gemma 3 4B) **or** LanguageTool | Model-based grammar assist is the local default; LanguageTool paths (local / self-hosted / hosted) are the rule-based alternative — see §5 |
| `POST /api/v1/analysis` | Primary | Structural/tone/quality analysis of the document |
| `POST /api/v1/evaluation` | Secondary (cross-check) | Scores primary output; rejects or flags rewrites below threshold |
| `GET /api/v1/models` | — | Lists Ollama tags + which is configured primary/secondary |
| `GET /api/v1/health` | — | Ollama reachability, loaded models, latency probe |

---

## 4. Evaluation plan (must run before the selection is considered validated)

Task 001 prohibited downloads/training, so the following is the **planned** evaluation to be
executed in a later task:

1. **Golden set**: assemble ~50–100 representative documents/paragraphs (by tone, length,
   domain, language) with human-approved "ideal" rewrites.
2. **Automatic metrics**: chrF/BLEU-style similarity to approved rewrites (with caution —
   low correlation with perceived quality), plus preservation checks (facts, numbers, named
   entities must not change).
3. **Profile adherence**: scripted prompts per writing profile (formal, concise, technical…)
   scored by a judge pass — initially a larger local model or human spot-check.
4. **Verification loop calibration**: measure how often `POST /api/v1/evaluation` rejects
   each model's output; tune thresholds so the secondary model catches real defects without
   discarding good rewrites.
5. **Resource measurements**: tokens/sec, time-to-first-token, peak memory per model tag on
   the minimum-spec machine. This decides the shipped default (Qwen3 primary is assumed
   faster; if not, the preference rows are flipped — no code change).
6. **Grammar parity check**: compare model-based grammar output against LanguageTool output
   on the golden set (see §5) before deciding which backs `POST /api/v1/grammar/check` by
   default.

---

## 5. Grammar processing note (model vs. LanguageTool)

The approved architecture lists **local grammar processing** with **optional self-hosted**
and **optional hosted LanguageTool**. Concretely:

| Path | Implementation | Default? |
| --- | --- | --- |
| Model-based grammar | Gemma 3 4B via `POST /api/v1/grammar/check` | Candidate default — fully local, no extra service |
| Self-hosted LanguageTool | Local JVM service; Next.js → AI service → `http://localhost:<port>` | Optional (rule-based precision; heavier footprint) |
| Hosted LanguageTool | Existing `grammar-engine.ts` logic, pointed at a configured URL | Optional, **explicit opt-in** (egress — violates local-first unless the user enables it) |

The existing `grammar-engine.ts` chunking/retry/offset-mapping logic is the reference
behavior any replacement must match (issue offsets drive editor decorations).

---

## 6. Future: fine-tuned open-weight writing model

- **Trigger**: when the golden set + accumulated rewrite history (with user accept/reject
  signals, stored as `RewriteVersion.isApplied`) reach a usable supervised dataset size.
- **Base candidates**: the same 4B-class open-weight families already qualified above —
  fine-tuning must not increase the hardware floor.
- **Serving**: same Ollama path; add a new tag to `ModelPreference`, promote it to
  `primary` via settings. No architecture change (this is why preferences are data, not
  code).
- **Out of scope until**: data collection pipeline, training infrastructure, and
  evaluation harness (§4) exist.

---

## 7. Open questions for Task 002+

1. Exact Ollama tags/quantizations to pin (pending the §4 resource measurements).
2. Whether `grammar/check` defaults to the model or self-hosted LanguageTool (pending §4.6).
3. Whether output verification runs inline (adds latency) or as a background pass.
4. Context-window budget per request: how much of a document the primary model sees per
   rewrite call (chunking strategy for large documents — the old 12 000-char LanguageTool
   chunking is the incumbent pattern).
