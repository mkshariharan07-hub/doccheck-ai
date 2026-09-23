import { NextRequest, NextResponse } from "next/server";
import { createReport, getDocumentWithAnalysis } from "@/lib/db";
import { requireAdmin, safeSegment, uploadToBucket } from "@/lib/supabase/admin";
import { generateReportPdf, getReportFileName } from "@/lib/pdf-report-generator";
import type { AnalysisResult, Document } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

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

    const pdfBuffer = generateReportPdf(
      document as Document,
      (analysis || {
        total_issues: 0,
        grammar_issues: 0,
        spelling_issues: 0,
        style_issues: 0,
        punctuation_issues: 0,
        plagiarism_status: "pending",
        plagiarism_score: null,
        ai_detection_status: "pending",
        ai_detection_score: null,
        issues: [],
        corrections_applied: [],
      }) as AnalysisResult
    );

    // Persist the report in Supabase Storage
    const reportPath = `reports/${documentId}/${safeSegment(
      getReportFileName(document.file_name)
    )}`;
    const client = requireAdmin();
    await uploadToBucket(
      client,
      "reports",
      reportPath,
      Buffer.from(pdfBuffer),
      "application/pdf"
    );

    await createReport({
      document_id: documentId,
      analysis_id: analysis?.id ?? null,
      pdf_storage_path: reportPath,
      generated_at: new Date().toISOString(),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getReportFileName(document.file_name)}"`,
      },
    });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}