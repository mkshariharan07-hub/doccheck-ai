import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { parseDocument } from "@/lib/document-parser";
import { validateFileType, validateFileSize } from "@/lib/file-utils";
import { analyzeText } from "@/lib/grammar-engine";
import { plagiarismService } from "@/lib/plagiarism-service";
import { aiDetectionService } from "@/lib/ai-detection-service";
import {
  ensureStorageBuckets,
  requireAdmin,
  safeSegment,
  uploadToBucket,
} from "@/lib/supabase/admin";
import { createDocument, updateDocument, upsertAnalysis } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!validateFileType(file)) {
      return NextResponse.json(
        { error: "Invalid file type. Only DOCX and PDF files are allowed." },
        { status: 400 }
      );
    }

    if (!validateFileSize(file)) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const client = requireAdmin();
    await ensureStorageBuckets(client);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";

    // Parse document
    const parsed = await parseDocument(buffer, fileType);

    if (!parsed.text.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted from this document. Scanned documents (image-only PDFs) are not supported yet." },
        { status: 422 }
      );
    }

    const docId = uuidv4();
    const now = new Date().toISOString();
    const originalStoragePath = `originals/${docId}/${safeSegment(file.name)}`;
    const contentType =
      fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    // Store the original file in Supabase Storage
    await uploadToBucket(client, "documents", originalStoragePath, buffer, contentType);

    // Create document record
    await createDocument({
      id: docId,
      file_name: file.name,
      file_type: fileType as "docx" | "pdf",
      file_size: file.size,
      original_storage_path: originalStoragePath,
      revised_storage_path: null,
      extracted_text: parsed.text,
      word_count: parsed.wordCount,
      char_count: parsed.charCount,
      paragraph_count: parsed.paragraphCount,
      status: "analyzing",
      created_at: now,
      updated_at: now,
    });

    // Analyze text
    const issues = await analyzeText(parsed.text);

    const grammarIssues = issues.filter((i) => i.type === "grammar").length;
    const spellingIssues = issues.filter((i) => i.type === "spelling").length;
    const styleIssues = issues.filter((i) => i.type === "style").length;
    const punctuationIssues = issues.filter((i) => i.type === "punctuation").length;

    const plagiarismResult = await plagiarismService.check(parsed.text);
    const aiDetectionResult = await aiDetectionService.detect(parsed.text);

    const analysis = await upsertAnalysis({
      id: uuidv4(),
      document_id: docId,
      total_issues: issues.length,
      grammar_issues: grammarIssues,
      spelling_issues: spellingIssues,
      style_issues: styleIssues,
      punctuation_issues: punctuationIssues,
      plagiarism_status: plagiarismResult.status as "pending" | "not_checked" | "checked",
      plagiarism_score: plagiarismResult.score,
      ai_detection_status: aiDetectionResult.status as
        | "pending"
        | "not_checked"
        | "checked",
      ai_detection_score: aiDetectionResult.score,
      issues,
      corrections_applied: [],
      created_at: now,
    });

    const analyzedDocument = await updateDocument(docId, { status: "analyzed" });

    return NextResponse.json({ document: analyzedDocument, analysis });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}