"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import {
  FileText,
  SpellCheck,
  Type,
  AlertTriangle,
  Shield,
  Bot,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { AnimatedContainer, AnimatedItem } from "@/components/animated/AnimatedContainer";
import { MotionButton } from "@/components/animated/MotionButton";
import { IssueCard } from "@/components/dashboard/IssueCard";
import Link from "next/link";

interface DocumentData {
  id: string;
  file_name: string;
  file_type: string;
  word_count: number;
  char_count: number;
  paragraph_count: number;
  status: string;
}

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

interface AnalysisData {
  id: string;
  document_id: string;
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
}

export default function DashboardPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/download/${documentId}`);
      if (!response.ok) throw new Error("Document not found");
      const data = await response.json();
      setDocument(data.document);
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    const id = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(id);
  }, [fetchData]);

  const filteredIssues =
    analysis?.issues.filter(
      (issue) => activeFilter === "all" || issue.type === activeFilter
    ) || [];

  const statCards = [
    {
      icon: FileText,
      label: "Total Words",
      value: document?.word_count ?? 0,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: SpellCheck,
      label: "Grammar Issues",
      value: analysis?.grammar_issues ?? 0,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      icon: Type,
      label: "Spelling Issues",
      value: analysis?.spelling_issues ?? 0,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: AlertTriangle,
      label: "Style Issues",
      value: analysis?.style_issues ?? 0,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      icon: Shield,
      label: "Plagiarism",
      value:
        analysis?.plagiarism_status === "checked"
          ? `${analysis?.plagiarism_score ?? 0}%`
          : analysis?.plagiarism_status === "not_checked"
            ? "No key"
            : "Pending",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      isPlaceholder: analysis?.plagiarism_status !== "checked",
    },
    {
      icon: Bot,
      label: "AI Detection",
      value:
        analysis?.ai_detection_status === "checked"
          ? `${analysis?.ai_detection_score ?? 0}%`
          : analysis?.ai_detection_status === "not_checked"
            ? "No key"
            : "Pending",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      isPlaceholder: analysis?.ai_detection_status !== "checked",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading analysis...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <AnimatedCard className="p-8 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link href="/upload">
            <Button className="gap-2 cursor-pointer">
              Upload New Document
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </AnimatedCard>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold mb-1">Analysis Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {document.file_name}
            <Badge variant="secondary">{document.file_type.toUpperCase()}</Badge>
          </p>
        </div>
        <div className="flex gap-3">
          <MotionButton
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </MotionButton>
          <Link href={`/editor/${documentId}`}>
            <MotionButton size="sm" className="gap-2 cursor-pointer">
              Open Editor
              <ArrowRight className="w-4 h-4" />
            </MotionButton>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <AnimatedContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((stat) => (
          <AnimatedItem key={stat.label}>
            <AnimatedCard className="p-4">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.isPlaceholder && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">
                  Add API key to enable
                </p>
              )}
            </AnimatedCard>
          </AnimatedItem>
        ))}
      </AnimatedContainer>

      {/* Issues Section */}
      <AnimatedCard delay={0.2} hover={false} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Detected Issues ({analysis?.total_issues ?? 0})
          </h2>
        </div>

        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              All ({analysis?.total_issues ?? 0})
            </TabsTrigger>
            <TabsTrigger value="grammar">
              Grammar ({analysis?.grammar_issues ?? 0})
            </TabsTrigger>
            <TabsTrigger value="spelling">
              Spelling ({analysis?.spelling_issues ?? 0})
            </TabsTrigger>
            <TabsTrigger value="punctuation">
              Punctuation ({analysis?.punctuation_issues ?? 0})
            </TabsTrigger>
            <TabsTrigger value="style">
              Style ({analysis?.style_issues ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeFilter} className="mt-0">
            {filteredIssues.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <SpellCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {activeFilter === "all"
                    ? "No issues detected. Your document looks great!"
                    : `No ${activeFilter} issues found.`}
                </p>
              </motion.div>
            ) : (
              <AnimatedContainer className="space-y-3">
                {filteredIssues.map((issue) => (
                  <AnimatedItem key={issue.id}>
                    <IssueCard issue={issue} />
                  </AnimatedItem>
                ))}
              </AnimatedContainer>
            )}
          </TabsContent>
        </Tabs>
      </AnimatedCard>

      {/* Plagiarism & AI Detection */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <AnimatedCard delay={0.3} hover={false} className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold">Plagiarism Check</h3>
              <p className="text-xs text-muted-foreground">
                {analysis?.plagiarism_status === "checked"
                  ? `${analysis.plagiarism_score}% matched content`
                  : analysis?.plagiarism_status === "not_checked"
                    ? "Set the PREPOSTSEO_API_KEY environment variable to enable"
                    : "Checking..."}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Scans your document against web sources in chunks of up to 2,000
            words and reports the share of matched content.
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.4} hover={false} className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold">AI Detection</h3>
              <p className="text-xs text-muted-foreground">
                {analysis?.ai_detection_status === "checked"
                  ? `${analysis.ai_detection_score}% likely AI-generated`
                  : analysis?.ai_detection_status === "not_checked"
                    ? "Set the AI_DETECTION_API_KEY environment variable to enable"
                    : "Checking..."}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Estimates how much of the document reads as AI-generated using a
            content detection API.
          </p>
        </AnimatedCard>
      </div>
    </div>
  );
}
