"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  FileText,
  Download,
  FileEdit,
  Loader2,
  CheckCircle2,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { AnimatedContainer, AnimatedItem } from "@/components/animated/AnimatedContainer";
import { MotionButton } from "@/components/animated/MotionButton";

interface DocumentData {
  id: string;
  file_name: string;
  file_type: string;
  word_count: number;
  char_count: number;
  paragraph_count: number;
  status: string;
}

interface AnalysisData {
  total_issues: number;
  grammar_issues: number;
  spelling_issues: number;
  style_issues: number;
  punctuation_issues: number;
}

export default function ResultsPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  const downloadRevisedDocx = async () => {
    setDownloadingDocx(true);
    try {
      const response = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, corrections: [] }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document?.file_name.replace(/\.[^/.]+$/, "")}_revised.docx`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Handle error
    } finally {
      setDownloadingDocx(false);
    }
  };

  const downloadReport = async () => {
    setDownloadingPdf(true);
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
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Analysis Complete</h1>
        <p className="text-muted-foreground">
          Your document has been analyzed. Download your results below.
        </p>
      </motion.div>

      <AnimatedContainer className="space-y-6">
        {/* Document Summary */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{document?.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  {document?.word_count} words •{" "}
                  {analysis?.total_issues} issues found
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {document?.file_type.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xl font-bold">{document?.word_count}</p>
                <p className="text-xs text-muted-foreground">Words</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xl font-bold text-red-500">
                  {analysis?.grammar_issues}
                </p>
                <p className="text-xs text-muted-foreground">Grammar</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xl font-bold text-orange-500">
                  {analysis?.spelling_issues}
                </p>
                <p className="text-xs text-muted-foreground">Spelling</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xl font-bold text-yellow-500">
                  {analysis?.style_issues}
                </p>
                <p className="text-xs text-muted-foreground">Style</p>
              </div>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* Download Options */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <h2 className="text-lg font-semibold mb-4">Download Results</h2>
            <div className="grid gap-4">
              <MotionButton
                variant="outline"
                onClick={downloadRevisedDocx}
                disabled={downloadingDocx}
                className="w-full justify-start gap-4 h-auto py-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  {downloadingDocx ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  ) : (
                    <FileEdit className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium">Revised Document (DOCX)</p>
                  <p className="text-sm text-muted-foreground">
                    Download the corrected version of your document
                  </p>
                </div>
                <Download className="w-4 h-4 ml-auto shrink-0" />
              </MotionButton>

              <MotionButton
                variant="outline"
                onClick={downloadReport}
                disabled={downloadingPdf}
                className="w-full justify-start gap-4 h-auto py-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  {downloadingPdf ? (
                    <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium">Analysis Report (PDF)</p>
                  <p className="text-sm text-muted-foreground">
                    Professional report with all findings and statistics
                  </p>
                </div>
                <Download className="w-4 h-4 ml-auto shrink-0" />
              </MotionButton>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* Quick Actions */}
        <AnimatedItem>
          <AnimatedCard hover={false} className="p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link href={`/editor/${documentId}`}>
                <MotionButton
                  variant="outline"
                  className="w-full gap-2 cursor-pointer"
                >
                  <FileEdit className="w-4 h-4" />
                  Open Editor
                </MotionButton>
              </Link>
              <Link href={`/report/${documentId}`}>
                <MotionButton
                  variant="outline"
                  className="w-full gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  View Report
                </MotionButton>
              </Link>
            </div>
          </AnimatedCard>
        </AnimatedItem>

        {/* New Upload */}
        <AnimatedItem>
          <Link href="/upload">
            <AnimatedCard className="p-6 text-center cursor-pointer hover:bg-muted/50">
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-1">Analyze Another Document</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                Upload a new document
                <ArrowRight className="w-3 h-3" />
              </p>
            </AnimatedCard>
          </Link>
        </AnimatedItem>
      </AnimatedContainer>
    </div>
  );
}
