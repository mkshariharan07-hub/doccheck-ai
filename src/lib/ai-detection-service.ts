import { AIDetectionService } from "@/types";

interface TextChunk {
  text: string;
}

const MAX_CHUNK_CHARACTERS = 9000;
const DEFAULT_API_URL = "https://api.ai-checker.co/v1/detect";
const MAX_CHUNK_RETRIES = 2;

function splitByCharacters(text: string, maxCharacters: number): TextChunk[] {
  if (text.length <= maxCharacters) {
    return [{ text }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxCharacters, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start) {
        end = boundary + 1;
      }
    }
    chunks.push({ text: text.substring(start, end) });
    start = end;
  }

  return chunks;
}

function extractScore(payload: unknown): number | null {
  const candidates: unknown[] = [];

  const collect = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;

    for (const key of [
      "score",
      "confidence",
      "aiScore",
      "aiPercentage",
      "probability",
      "ai_probability",
    ]) {
      if (record[key] !== undefined) {
        candidates.push(record[key]);
      }
    }

    for (const nested of ["result", "data", "analysis"]) {
      if (typeof record[nested] === "object" && record[nested] !== null) {
        collect(record[nested]);
      }
    }
  };

  collect(payload);

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate <= 1 ? Math.round(candidate * 100) : Math.round(candidate);
    }
    if (typeof candidate === "string") {
      const parsed = parseFloat(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
      }
    }
  }

  return null;
}

async function detectChunk(
  url: string,
  apiKey: string | undefined,
  text: string
): Promise<number | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`AI detection API unauthorized: ${response.status}`);
        }
        lastError = new Error(`AI detection API error: ${response.status}`);
        continue;
      }

      const body = await response.json();
      return extractScore(body);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("AI detection API unauthorized")
      ) {
        throw error;
      }
      lastError =
        error instanceof Error ? error : new Error("AI detection request failed");
    }
  }

  throw lastError ?? new Error("AI detection request failed");
}

export const aiDetectionService: AIDetectionService = {
  async detect(text: string) {
    const url = process.env.AI_DETECTION_API_URL || DEFAULT_API_URL;
    const apiKey = process.env.AI_DETECTION_API_KEY;

    const trimmed = text.trim();
    if (!trimmed) {
      return { status: "checked", score: 0, details: { chunks: 0 } };
    }

    try {
      const chunks = splitByCharacters(trimmed, MAX_CHUNK_CHARACTERS);
      const scores = await Promise.all(
        chunks.map((chunk) => detectChunk(url, apiKey, chunk.text))
      );

      const validScores = scores.filter(
        (score): score is number => typeof score === "number"
      );

      if (validScores.length === 0) {
        return {
          status: "not_checked",
          score: null,
          details: { reason: "AI detection API returned no score" },
        };
      }

      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            validScores.reduce((sum, value) => sum + value, 0) / validScores.length
          )
        )
      );

      return { status: "checked", score, details: { chunks: scores.length } };
    } catch (error) {
      console.error("AI detection failed:", error);
      return {
        status: "not_checked",
        score: null,
        details: { reason: "AI detection API unavailable" },
      };
    }
  },
};