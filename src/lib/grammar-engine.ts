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

export async function analyzeText(
  text: string,
  language = "en-US"
): Promise<Issue[]> {
  const apiUrl =
    process.env.Languagetool_API_URL ||
    "https://api.languagetool.org/v2/check";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      text,
      language,
      enabledOnly: "false",
    }),
  });

  if (!response.ok) {
    throw new Error(`LanguageTool API error: ${response.status}`);
  }

  const data = await response.json();
  const matches: LanguageToolMatch[] = data.matches || [];

  return matches.map((match, index) => ({
    id: `issue-${index}-${match.rule.id}`,
    originalText: text.substring(match.offset, match.offset + match.length),
    startOffset: match.offset,
    endOffset: match.offset + match.length,
    type: mapCategoryToIssueType(match.rule.category.id),
    message: match.message,
    suggestedFix:
      match.replacements.length > 0 ? match.replacements[0].value : null,
    ruleId: match.rule.id,
    category: match.rule.category.name,
  }));
}
