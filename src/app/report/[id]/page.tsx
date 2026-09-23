"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import {
  FileText,
  Download,
  Loader2,
  Calendar,
  AlertTriangle,
  Shield,
  Bot,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { AnimatedContainer, AnimatedItem } from "@/components/animated/AnimatedContainer";
import { MotionButton } from "@/components/animated/MotionButton";

interface DocumentData {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  word_count: number;
  char_count: number;
  paragraph_count: number;
  status: string;
  created_at: string;
}

interface Issue {
  id: string;
  originalText: string;
  type: string;
  message: string;
  suggestedFix: string | null;
  category: string;
}

interface AnalysisData {
  total_issues: number;
  grammar_issues: number;
  spelling_issues: number;
  style_issues: number;
  punctuation_issues: number;
  plagiarism_status: string;
  plagiarism_score: number | null;
  ai_detection_status: string;
  ai_detection_score: number | null;
  issues: Issue[];
  corrections_applied: unknown[];
}

export default function ReportPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/download/${documentId}`);
      if (!response.ok) throw new Error("Document not found");
      const data = await response.json();
      setDocument(data.document);
      setAnalysis(data.analysis);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    const id = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(id);
  }, [fetchData]);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) throw new Error("Report generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document?.file_name.replace(/\.[^/.]+$/, "")}_analysis_report.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Handle error
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!document || !analysis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <AnimatedCard className="p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">Document not found</p>
        </AnimatedCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold mb-1">Analysis Report</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {document.file_name}
          </p>
        </div>
        <MotionButton
          onClick={downloadReport}
          disabled={downloading}
          className="gap-2 cursor-pointer"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download PDF Report
        </MotionButton>
      </motion.div>

      <AnimatedContainer className="space-y-6">
        {/* Document Info */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document Information
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">File Name</p>
                <p className="font-medium">{document.file_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Type</p>
                <Badge variant="secondary">{document.file_type.toUpperCase()}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Size</p>
                <p className="font-medium">
                  {(document.file_size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Analysis Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(document.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* Statistics */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <h2 className="text-lg font-semibold mb-4">Document Statistics</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {document.word_count}
                </p>
                <p className="text-sm text-muted-foreground">Words</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {document.char_count}
                </p>
                <p className="text-sm text-muted-foreground">Characters</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {document.paragraph_count}
                </p>
                <p className="text-sm text-muted-foreground">Paragraphs</p>
              </div>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* Issue Summary */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <h2 className="text-lg font-semibold mb-4">Issue Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-red-500">
                  {analysis.grammar_issues}
                </p>
                <p className="text-sm text-muted-foreground">Grammar</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-orange-500">
                  {analysis.spelling_issues}
                </p>
                <p className="text-sm text-muted-foreground">Spelling</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-blue-500">
                  {analysis.punctuation_issues}
                </p>
                <p className="text-sm text-muted-foreground">Punctuation</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">
                  {analysis.style_issues}
                </p>
                <p className="text-sm text-muted-foreground">Style</p>
              </div>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* Plagiarism & AI Detection */}
        <div className="grid md:grid-cols-2 gap-6">
          <AnimatedItem>
            <AnimatedCard hover={false} className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Plagiarism Check</h3>
                  <p className="text-xs text-muted-foreground">
                    Content originality analysis
                  </p>
                </div>
              </div>
              <Separator className="mb-4" />
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {analysis.plagiarism_status === "pending"
                    ? "Not yet analyzed"
                    : `Score: ${analysis.plagiarism_score}%`}
                </p>
                {analysis.plagiarism_status === "pending" && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Connect a plagiarism API for real results
                  </p>
                )}
              </div>
            </AnimatedCard>
          </AnimatedItem>

          <AnimatedItem>
            <AnimatedCard hover={false} className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Detection</h3>
                  <p className="text-xs text-muted-foreground">
                    AI-generated content detection
                  </p>
                </div>
              </div>
              <Separator className="mb-4" />
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {analysis.ai_detection_status === "pending"
                    ? "Not yet analyzed"
                    : `Score: ${analysis.ai_detection_score}%`}
                </p>
                {analysis.ai_detection_status === "pending" && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Connect an AI detection API for real results
                  </p>
                )}
              </div>
            </AnimatedCard>
          </AnimatedItem>
        </div>

        {/* Detailed Findings */}
        {analysis.issues.length > 0 && (
          <AnimatedItem>
            <AnimatedCard hover={false} className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Detailed Findings ({analysis.issues.length} issues)
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analysis.issues.map((issue, i) => (
                  <div
                    key={issue.id}
                    className="p-3 border rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {issue.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        #{i + 1}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      &quot;{issue.originalText}&quot;
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {issue.message}
                    </p>
                    {issue.suggestedFix && (
                      <p className="text-xs text-green-600 mt-1">
                        Suggestion: &quot;{issue.suggestedFix}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </AnimatedItem>
        )}

        {/* Corrections Applied */}
        {analysis.corrections_applied.length > 0 && (
          <AnimatedItem>
            <AnimatedCard hover={false} className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Corrections Applied ({analysis.corrections_applied.length})
              </h2>
              <div className="space-y-2">
                {analysis.corrections_applied.map((c, i) => {
                  const correction = c as {
                    originalText: string;
                    correctedText: string;
                  };
                  return (
                    <div
                      key={i}
                      className="p-3 border rounded-lg bg-green-500/5"
                    >
                      <p className="text-sm">
                        <span className="text-red-500 line-through">
                          {correction.originalText}
                        </span>
                        {" → "}
                        <span className="text-green-600 font-medium">
                          {correction.correctedText}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </AnimatedCard>
          </AnimatedItem>
        )}
      </AnimatedContainer>
    </div>
  );
}
