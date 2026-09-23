"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Lightbulb } from "lucide-react";

interface Issue {
  id: string;
  originalText: string;
  type: "grammar" | "spelling" | "punctuation" | "style";
  message: string;
  suggestedFix: string | null;
  category: string;
}

const typeColors: Record<string, string> = {
  grammar: "bg-red-500/10 text-red-600 border-red-500/20",
  spelling: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  punctuation: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  style: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className={`text-xs ${typeColors[issue.type] || ""}`}
            >
              {issue.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {issue.category}
            </span>
          </div>
          <p className="text-sm font-medium mb-1">
            &quot;{issue.originalText}&quot;
          </p>
          <p className="text-sm text-muted-foreground mb-2">{issue.message}</p>
          {issue.suggestedFix && (
            <div className="flex items-center gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">
                Suggestion: &quot;{issue.suggestedFix}&quot;
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
