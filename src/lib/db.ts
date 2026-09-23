import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import type { AnalysisResult, Document, Report } from "@/types";

interface DocumentWithAnalysis {
  document: Document;
  analysis: AnalysisResult | null;
}

export async function createDocument(
  input: Omit<Document, "revised_storage_path"> & {
    revised_storage_path: string | null;
  }
): Promise<Document> {
  const { data, error } = await requireAdmin()
    .from("documents")
    .insert({
      id: input.id,
      file_name: input.file_name,
      file_type: input.file_type,
      file_size: input.file_size,
      original_storage_path: input.original_storage_path,
      revised_storage_path: input.revised_storage_path,
      extracted_text: input.extracted_text,
      word_count: input.word_count,
      char_count: input.char_count,
      paragraph_count: input.paragraph_count,
      status: input.status,
      created_at: input.created_at,
      updated_at: input.updated_at,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Document;
}

export async function updateDocument(
  id: string,
  patch: Partial<Document>
): Promise<Document> {
  const { data, error } = await requireAdmin()
    .from("documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Document;
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await requireAdmin()
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as Document) ?? null;
}

export async function getDocumentWithAnalysis(
  id: string
): Promise<DocumentWithAnalysis | null> {
  const document = await getDocument(id);
  if (!document) return null;

  const analysis = await getAnalysisByDocument(id);
  return { document, analysis };
}

export async function upsertAnalysis(
  input: Omit<AnalysisResult, "created_at"> & { created_at: string }
): Promise<AnalysisResult> {
  const { data, error } = await requireAdmin()
    .from("analyses")
    .upsert(input, { onConflict: "document_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as AnalysisResult;
}

export async function patchAnalysis(
  documentId: string,
  patch: Pick<Partial<AnalysisResult>, "corrections_applied">
): Promise<AnalysisResult> {
  const { data, error } = await requireAdmin()
    .from("analyses")
    .update(patch)
    .eq("document_id", documentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AnalysisResult;
}

export async function getAnalysisByDocument(
  documentId: string
): Promise<AnalysisResult | null> {
  const { data, error } = await requireAdmin()
    .from("analyses")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();

  if (error) throw error;
  return (data as AnalysisResult) ?? null;
}

export async function createReport(input: {
  document_id: string;
  analysis_id: string | null;
  pdf_storage_path: string;
  generated_at: string;
}): Promise<Report> {
  const { data, error } = await requireAdmin()
    .from("reports")
    .insert({
      document_id: input.document_id,
      analysis_id: input.analysis_id,
      pdf_storage_path: input.pdf_storage_path,
      generated_at: input.generated_at,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Report;
}

export async function getLatestReport(documentId: string): Promise<Report | null> {
  const { data, error } = await requireAdmin()
    .from("reports")
    .select("*")
    .eq("document_id", documentId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Report) ?? null;
}