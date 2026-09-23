import { Issue } from "@/types";

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: {
    id: string;
    category: {
      id: string;
      name: string;
    };
  };
}

interface TextChunk {
  text: string;
  startOffset: number;
}

const MAX_CHUNK_CHARACTERS = 12000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function mapCategoryToIssueType(categoryId: string): Issue["type"] {
  switch (categoryId) {
    case "GRAMMAR":
      return "grammar";
    case "TYPOS":
      return "spelling";
    case "PUNCTUATION":
      return "punctuation";
    case "STYLE":
      return "style";
    case "CASING":
      return "style";
    default:
      return "grammar";
  }
}

function splitIntoChunks(text: string, maxCharacters: number): TextChunk[] {
  if (text.length <= maxCharacters) {
    return [{ text, startOffset: 0 }];
  }

  const chunks: TextChunk[] = [];
  let chunkStart = 0;

  while (chunkStart < text.length) {
    let chunkEnd = Math.min(chunkStart + maxCharacters, text.length);

    if (chunkEnd < text.length) {
      const boundary = text.lastIndexOf(" ", chunkEnd);
      if (boundary > chunkStart) {
        chunkEnd = boundary + 1;
      }
    }

    chunks.push({
      text: text.substring(chunkStart, chunkEnd),
      startOffset: chunkStart,
    });
    chunkStart = chunkEnd;
  }

  return chunks;
}

function parseMatches(
  matches: LanguageToolMatch[],
  chunkStartOffset: number,
  text: string
): Issue[] {
  return matches.map((match, index) => ({
    id: `issue-${chunkStartOffset}-${index}-${match.rule.id}`,
    originalText: text.substring(match.offset, match.offset + match.length),
    startOffset: chunkStartOffset + match.offset,
    endOffset: chunkStartOffset + match.offset + match.length,
    type: mapCategoryToIssueType(match.rule.category.id),
    message: match.message,
    suggestedFix:
      match.replacements.length > 0 ? match.replacements[0].value : null,
    ruleId: match.rule.id,
    category: match.rule.category.name,
  }));
}

async function checkChunk(
  text: string,
  language: string
): Promise<LanguageToolMatch[]> {
  const apiUrl =
    process.env.Languagetool_API_URL ||
    "https://api.languagetool.org/v2/check";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const retryAfterMs =
        Math.pow(2, attempt) * RETRY_BASE_DELAY_MS +
        Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text,
          language,
          enabledOnly: "false",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.matches as LanguageToolMatch[]) || [];
      }

      lastError = new Error(`LanguageTool API error: ${response.status}`);

      if (response.status === 429 || response.status >= 500) {
        continue;
      }

      return [];
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("LanguageTool request failed");
    }
  }

  console.error("LanguageTool failed after retries:", lastError);
  return [];
}

export async function analyzeText(
  text: string,
  language = "en-US"
): Promise<Issue[]> {
  const chunks = splitIntoChunks(text, MAX_CHUNK_CHARACTERS);
  const issues: Issue[] = [];

  for (const chunk of chunks) {
    const matches = await checkChunk(chunk.text, language);
    issues.push(...parseMatches(matches, chunk.startOffset, chunk.text));
  }

  return issues;
}