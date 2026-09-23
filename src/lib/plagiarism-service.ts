import { PlagiarismService } from "@/types";

interface PrepostSeoSrc {
  link: string;
  count: number;
  percent: number;
}

interface PrepostSeoResponse {
  isQueriesFinished?: string;
  sources?: PrepostSeoSrc[];
  totalQueries?: number;
  plagPercent?: number;
  paraphrasePercent?: number;
  uniquePercent?: number;
  excludeURL?: string;
  type?: string;
  message?: string;
}

interface TextChunk {
  text: string;
  wordCount: number;
}

const MAX_WORDS_PER_REQUEST = 2000;
const API_URL = "https://www.prepostseo.com/apis/checkPlag";
const MAX_CHUNK_RETRIES = 2;

function splitByWordLimit(text: string, maxWords: number): TextChunk[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= maxWords) {
    return [{ text, wordCount: words.length }];
  }

  const chunks: TextChunk[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push({
      text: words.slice(i, i + maxWords).join(" "),
      wordCount: Math.min(maxWords, words.length - i),
    });
  }
  return chunks;
}

async function checkChunk(key: string, text: string): Promise<PrepostSeoResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 * Math.pow(2, attempt))
      );
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          key,
          data: text,
        }),
      });

      let body: PrepostSeoResponse | null = null;
      try {
        body = (await response.json()) as PrepostSeoResponse;
      } catch {
        body = null;
      }

      if (body?.type === "invalid_request") {
        throw new Error(`PrepostSEO: ${body.message || "invalid API key"}`);
      }

      if (!response.ok) {
        lastError = new Error(`PrepostSEO API error: ${response.status}`);
        continue;
      }

      return body as PrepostSeoResponse;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("PrepostSEO:")) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error("PrepostSEO request failed");
    }
  }

  throw lastError ?? new Error("PrepostSEO request failed");
}

export const plagiarismService: PlagiarismService = {
  async check(text: string) {
    const key = process.env.PREPOSTSEO_API_KEY;

    if (!key) {
      return {
        status: "not_checked",
        score: null,
        details: { reason: "PREPOSTSEO_API_KEY is not configured" },
      };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { status: "checked", score: 0, details: { chunks: [] } };
    }

    try {
      const chunks = splitByWordLimit(trimmed, MAX_WORDS_PER_REQUEST);
      const results = await Promise.all(
        chunks.map((chunk) => checkChunk(key, chunk.text))
      );

      const totalWords = chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
      const plagiarizedWords = results.reduce((sum, result, index) => {
        const percent = result.plagPercent ?? 0;
        return sum + (percent / 100) * chunks[index].wordCount;
      }, 0);

      const score = Math.max(
        0,
        Math.min(100, Math.round((plagiarizedWords / totalWords) * 100))
      );

      const sources = results
        .flatMap((result) => result.sources ?? [])
        .map((source) => ({
          url: source.link,
          matchedWords: source.count,
          matchPercent: source.percent,
        }))
        .sort((a, b) => b.matchedWords - a.matchedWords)
        .slice(0, 20);

      return {
        status: "checked",
        score,
        details: { chunks: results.length, sources },
      };
    } catch (error) {
      console.error("Plagiarism check failed:", error);
      return {
        status: "not_checked",
        score: null,
        details: { reason: "Plagiarism API unavailable" },
      };
    }
  },
};