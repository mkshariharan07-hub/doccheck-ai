import { NextRequest, NextResponse } from "next/server";
import { getDocumentWithAnalysis, patchAnalysis, updateDocument } from "@/lib/db";
import { requireAdmin, safeSegment, uploadToBucket } from "@/lib/supabase/admin";
import { generateRevisedDocx, getRevisedFileName } from "@/lib/docx-generator";

interface CorrectionInput {
  issueId?: string;
  originalText?: string;
  correctedText?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, text, corrections } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const record = await getDocumentWithAnalysis(documentId);
    if (!record) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const { document, analysis } = record;
    const now = new Date().toISOString();

    let correctedText: string;
    let correctionsToStore: {
      issueId: string;
      originalText: string;
      correctedText: string;
      appliedAt: string;
    }[];

    if (typeof text === "string" && text.trim()) {
      // Editor flow: use the final text as-is, including any manual edits.
      correctedText = text;
      const issuesByRule = new Map(
        (analysis?.issues ?? []).map((issue) => [issue.id, issue])
      );
      correctionsToStore = Array.isArray(corrections)
        ? corrections
            .filter(
              (c: CorrectionInput) =>
                c.issueId &&
                c.correctedText &&
                typeof c.correctedText === "string" &&
                issuesByRule.has(c.issueId)
            )
            .map((c: CorrectionInput) => {
              const issue = c.issueId ? issuesByRule.get(c.issueId) : undefined;
              return {
                issueId: c.issueId as string,
                originalText: c.originalText || issue?.originalText || "",
                correctedText: c.correctedText as string,
                appliedAt: now,
              };
            })
        : [];
    } else {
      // Results flow: re-apply previously stored corrections to the original text.
      correctedText = document.extracted_text;
      correctionsToStore = analysis?.corrections_applied ?? [];

      const issuesByRule = new Map(
        (analysis?.issues ?? []).map((issue) => [issue.id, issue])
      );

      const sorted = [...correctionsToStore].sort((a, b) => {
        const offsetA = issuesByRule.get(a.issueId)?.startOffset ?? 0;
        const offsetB = issuesByRule.get(b.issueId)?.startOffset ?? 0;
        return offsetB - offsetA;
      });

      for (const correction of sorted) {
        const issue = issuesByRule.get(correction.issueId);
        if (!issue) continue;
        const start =
          correctedText.substring(
            issue.startOffset,
            issue.startOffset + issue.originalText.length
          ) === issue.originalText
            ? issue.startOffset
            : correctedText.indexOf(issue.originalText);
        if (start === -1) continue;
        correctedText =
          correctedText.substring(0, start) +
          correction.correctedText +
          correctedText.substring(start + issue.originalText.length);
      }
    }

    // Generate revised DOCX
    const docxBuffer = await generateRevisedDocx(correctedText, document.file_name);

    // Persist the revised file in Supabase Storage
    const revisedPath = `revised/${documentId}/${safeSegment(
      getRevisedFileName(document.file_name)
    )}`;
    const client = requireAdmin();
    await uploadToBucket(
      client,
      "documents",
      revisedPath,
      Buffer.from(docxBuffer),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    await updateDocument(documentId, {
      revised_storage_path: revisedPath,
      status: "corrected",
    });

    if (analysis) {
      await patchAnalysis(documentId, { corrections_applied: correctionsToStore });
    }

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${getRevisedFileName(document.file_name)}"`,
      },
    });
  } catch (error) {
    console.error("Correct error:", error);
    return NextResponse.json(
      { error: "Failed to generate corrected document" },
      { status: 500 }
    );
  }
}