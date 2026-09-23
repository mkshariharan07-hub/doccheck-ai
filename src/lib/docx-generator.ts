import { Document, Packer, Paragraph, TextRun } from "docx";

export async function generateRevisedDocx(
  correctedText: string,
  originalFileName: string
): Promise<Buffer> {
  const paragraphs = correctedText.split(/\n\s*\n/).filter((p) => p.trim());

  const doc = new Document({
    creator: "DocCheck AI",
    title: originalFileName,
    sections: [
      {
        properties: {},
        children: paragraphs.map(
          (text) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: text.trim(),
                  font: "Calibri",
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            })
        ),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

export function getRevisedFileName(originalFileName: string): string {
  const name = originalFileName.replace(/\.[^/.]+$/, "");
  return `${name}_revised.docx`;
}
