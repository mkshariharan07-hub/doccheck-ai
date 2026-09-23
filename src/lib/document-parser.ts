import mammoth from "mammoth";

export interface ParsedDocument {
  text: string;
  paragraphs: string[];
  wordCount: number;
  charCount: number;
  paragraphCount: number;
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function extractParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const paragraphs = extractParagraphs(text);

  return {
    text,
    paragraphs,
    wordCount: countWords(text),
    charCount: text.length,
    paragraphCount: paragraphs.length,
  };
}

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const text = textResult.text;
  const paragraphs = extractParagraphs(text);

  return {
    text,
    paragraphs,
    wordCount: countWords(text),
    charCount: text.length,
    paragraphCount: paragraphs.length,
  };
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<ParsedDocument> {
  if (fileType === "docx") {
    return parseDocx(buffer);
  }
  if (fileType === "pdf") {
    return parsePdf(buffer);
  }
  throw new Error(`Unsupported file type: ${fileType}`);
}
