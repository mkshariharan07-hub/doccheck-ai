export interface Document {
  id: string;
  file_name: string;
  file_type: "docx" | "pdf";
  file_size: number;
  original_storage_path: string;
  revised_storage_path: string | null;
  extracted_text: string;
  word_count: number;
  char_count: number;
  paragraph_count: number;
  status:
    | "uploaded"
    | "parsing"
    | "parsed"
    | "analyzing"
    | "analyzed"
    | "correcting"
    | "corrected";
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  originalText: string;
  startOffset: number;
  endOffset: number;
  type: "grammar" | "spelling" | "punctuation" | "style";
  message: string;
  suggestedFix: string | null;
  ruleId: string;
  category: string;
}

export interface AnalysisResult {
  id: string;
  document_id: string;
  total_issues: number;
  grammar_issues: number;
  spelling_issues: number;
  style_issues: number;
  punctuation_issues: number;
  plagiarism_status: "pending" | "not_checked" | "checked";
  plagiarism_score: number | null;
  ai_detection_status: "pending" | "not_checked" | "checked";
  ai_detection_score: number | null;
  issues: Issue[];
  corrections_applied: CorrectionRecord[];
  created_at: string;
}

export interface CorrectionRecord {
  issueId: string;
  originalText: string;
  correctedText: string;
  appliedAt: string;
}

export interface Report {
  id: string;
  document_id: string;
  analysis_id: string;
  pdf_storage_path: string | null;
  generated_at: string;
}

export interface PlagiarismService {
  check(
    text: string
  ): Promise<{ status: string; score: number | null; details: null }>;
}

export interface AIDetectionService {
  detect(
    text: string
  ): Promise<{ status: string; score: number | null; details: null }>;
}

export interface UploadResponse {
  document: Document;
  analysis: AnalysisResult;
}

export interface AnalyzeResponse {
  analysis: AnalysisResult;
}

export interface CorrectResponse {
  document: Document;
  downloadUrl: string;
}

export interface ReportResponse {
  report: Report;
  downloadUrl: string;
}
