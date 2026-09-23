"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeftRight,
  Check,
  Undo2,
  RotateCcw,
  Download,
  Loader2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { MotionButton } from "@/components/animated/MotionButton";

interface Issue {
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

interface DocumentData {
  id: string;
  file_name: string;
  extracted_text: string;
  word_count: number;
}

interface AnalysisData {
  issues: Issue[];
}

interface CorrectionRecord {
  issueId: string;
  originalText: string;
  correctedText: string;
}

interface Snapshot {
  text: string;
  corrections: CorrectionRecord[];
  issues: Issue[];
}

const typeColors: Record<string, string> = {
  grammar: "bg-red-500/10 text-red-600",
  spelling: "bg-orange-500/10 text-orange-600",
  punctuation: "bg-blue-500/10 text-blue-600",
  style: "bg-yellow-500/10 text-yellow-600",
};

function locateIssue(text: string, issue: Issue): number {
  if (
    issue.startOffset >= 0 &&
    issue.startOffset + issue.originalText.length <= text.length &&
    text.substring(
      issue.startOffset,
      issue.startOffset + issue.originalText.length
    ) === issue.originalText
  ) {
    return issue.startOffset;
  }
  return text.indexOf(issue.originalText);
}

export default function EditorPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [originalAnalysis, setOriginalAnalysis] = useState<AnalysisData | null>(null);
  const [editedText, setEditedText] = useState("");
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [histories, setHistories] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const lastTypedAt = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/download/${documentId}`);
      if (!response.ok) throw new Error("Document not found");
      const data = await response.json();
      setDocument(data.document);
      setAnalysis(data.analysis);
      setOriginalAnalysis(data.analysis);
      setEditedText(data.document.extracted_text);
      setCorrections([]);
      setHistories([]);
      lastTypedAt.current = 0;
    } catch {
      // Handled by the "document not found" state below
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    const id = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(id);
  }, [fetchData]);

  const handleTextChange = (value: string) => {
    const now = Date.now();
    if (now - lastTypedAt.current > 800 && histories.length === 0) {
      setHistories((prev) => [
        ...prev,
        {
          text: editedText,
          corrections,
          issues: analysis?.issues ?? [],
        },
      ]);
    }
    lastTypedAt.current = now;
    setEditedText(value);
  };

  const applyCorrection = (issue: Issue) => {
    if (!issue.suggestedFix) return;

    setHistories((prev) => [
      ...prev,
      { text: editedText, corrections, issues: analysis?.issues ?? [] },
    ]);

    const startIdx = locateIssue(editedText, issue);
    if (startIdx === -1) return;

    const newText =
      editedText.substring(0, startIdx) +
      issue.suggestedFix +
      editedText.substring(startIdx + issue.originalText.length);

    const newCorrection: CorrectionRecord = {
      issueId: issue.id,
      originalText: issue.originalText,
      correctedText: issue.suggestedFix,
    };

    const lengthDiff = issue.suggestedFix.length - issue.originalText.length;
    const nextIssues = (analysis?.issues ?? [])
      .filter((i) => i.id !== issue.id)
      .map((i) =>
        i.startOffset > startIdx
          ? {
              ...i,
              startOffset: i.startOffset + lengthDiff,
              endOffset: i.endOffset + lengthDiff,
            }
          : i
      );

    setEditedText(newText);
    setCorrections((prev) => [...prev, newCorrection]);
    setAnalysis((prev) => (prev ? { ...prev, issues: nextIssues } : prev));
  };

  const applyAllCorrections = () => {
    if (!analysis) return;

    let text = editedText;
    const applied: CorrectionRecord[] = [];
    const candidates = analysis.issues
      .filter((i) => i.suggestedFix)
      .slice()
      .sort((a, b) => b.startOffset - a.startOffset);

    for (const issue of candidates) {
      const startIdx = locateIssue(text, issue);
      if (startIdx === -1 || !issue.suggestedFix) continue;
      text =
        text.substring(0, startIdx) +
        issue.suggestedFix +
        text.substring(startIdx + issue.originalText.length);
      applied.push({
        issueId: issue.id,
        originalText: issue.originalText,
        correctedText: issue.suggestedFix,
      });
    }

    if (applied.length === 0) return;

    setHistories((prev) => [
      ...prev,
      { text: editedText, corrections, issues: analysis.issues },
    ]);
    const appliedIds = new Set(applied.map((a) => a.issueId));
    setEditedText(text);
    setCorrections((prev) => [...prev, ...applied]);
    setAnalysis((prev) =>
      prev ? { ...prev, issues: prev.issues.filter((i) => !appliedIds.has(i.id)) } : prev
    );
  };

  const undo = () => {
    if (histories.length === 0) return;
    const snapshot = histories[histories.length - 1];
    setHistories((prev) => prev.slice(0, -1));
    setEditedText(snapshot.text);
    setCorrections(snapshot.corrections);
    setAnalysis((prev) => (prev ? { ...prev, issues: snapshot.issues } : prev));
    lastTypedAt.current = Date.now();
  };

  const resetText = () => {
    if (!document) return;
    setHistories((prev) => [
      ...prev,
      { text: editedText, corrections, issues: analysis?.issues ?? [] },
    ]);
    setEditedText(document.extracted_text);
    setCorrections([]);
    setAnalysis(originalAnalysis);
    lastTypedAt.current = Date.now();
  };

  const downloadRevised = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          text: editedText,
          corrections,
        }),
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

  const unresolvedIssues = analysis.issues.filter(
    (issue) => !corrections.some((c) => c.issueId === issue.id)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{document.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {document.word_count} words • {corrections.length} corrections
              applied
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MotionButton
            variant="outline"
            size="sm"
            onClick={applyAllCorrections}
            disabled={unresolvedIssues.filter((i) => i.suggestedFix).length === 0}
            className="gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Apply All
          </MotionButton>
          <MotionButton
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={histories.length === 0}
            className="gap-1.5 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </MotionButton>
          <MotionButton
            variant="outline"
            size="sm"
            onClick={resetText}
            className="gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </MotionButton>
          <Separator orientation="vertical" className="h-6" />
          <MotionButton
            size="sm"
            onClick={downloadRevised}
            disabled={downloading}
            className="gap-1.5 cursor-pointer"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download Revised
          </MotionButton>
        </div>
      </motion.div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Original Pane */}
        <div className="flex-1 flex flex-col border-r">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Original</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              Read-only
            </Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {document.extracted_text}
            </div>
          </ScrollArea>
        </div>

        {/* Edited Pane */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">Edited</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {corrections.length} applied
            </Badge>
          </div>
          <ScrollArea className="flex-1">
            <textarea
              value={editedText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full h-full min-h-[500px] p-4 font-mono text-sm leading-relaxed bg-transparent border-none outline-none resize-none"
            />
          </ScrollArea>
        </div>

        {/* Correction Panel */}
        <div className="w-80 flex flex-col border-l bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">
              Corrections ({unresolvedIssues.length} remaining)
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              <AnimatePresence>
                {unresolvedIssues.map((issue) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    className="border rounded-lg p-3 bg-muted/20"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${typeColors[issue.type]}`}
                      >
                        {issue.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {issue.category}
                      </span>
                    </div>
                    <p className="text-xs font-medium mb-1 line-clamp-2">
                      &quot;{issue.originalText}&quot;
                    </p>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {issue.message}
                    </p>
                    {issue.suggestedFix ? (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-3 h-3 text-green-500 shrink-0" />
                        <span className="text-xs text-green-600 line-clamp-1">
                          &quot;{issue.suggestedFix}&quot;
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic mb-2">
                        No suggestion available
                      </p>
                    )}
                    {issue.suggestedFix && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyCorrection(issue)}
                        className="w-full text-xs h-7 gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Apply
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {unresolvedIssues.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    All issues resolved!
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}