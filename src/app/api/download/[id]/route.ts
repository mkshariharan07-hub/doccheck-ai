import { NextRequest, NextResponse } from "next/server";
import { getDocumentWithAnalysis, getLatestReport } from "@/lib/db";
import {
  downloadFromBucket,
  requireAdmin,
  safeSegment,
} from "@/lib/supabase/admin";
import { getReportFileName } from "@/lib/pdf-report-generator";
import { getRevisedFileName } from "@/lib/docx-generator";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
  }

  try {
    const type = request.nextUrl.searchParams.get("type");

    if (type) {
      const record = await getDocumentWithAnalysis(id);
      if (!record) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      const { document } = record;
      const client = requireAdmin();

      let bucket: string;
      let path: string;
      let filename: string;
      let contentType: string;

      switch (type) {
        case "original": {
          bucket = "documents";
          path = `originals/${id}/${safeSegment(document.file_name)}`;
          filename = document.file_name;
          contentType = document.file_type === "pdf" ? "application/pdf" : DOCX_MIME;
          break;
        }
        case "revised": {
          bucket = "documents";
          filename = getRevisedFileName(document.file_name);
          path =
            document.revised_storage_path ??
            `revised/${id}/${safeSegment(filename)}`;
          contentType = DOCX_MIME;
          break;
        }
        case "report": {
          bucket = "reports";
          filename = getReportFileName(document.file_name);
          const report = await getLatestReport(id);
          path = report?.pdf_storage_path ?? `reports/${id}/${safeSegment(filename)}`;
          contentType = "application/pdf";
          break;
        }
        default:
          return NextResponse.json(
            { error: `Unknown file type: ${type}` },
            { status: 400 }
          );
      }

      const blob = await downloadFromBucket(client, bucket, path);
      return new NextResponse(new Uint8Array(await blob.arrayBuffer()), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Metadata used by all detail pages
    const record = await getDocumentWithAnalysis(id);
    if (!record) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      document: record.document,
      analysis: record.analysis,
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}