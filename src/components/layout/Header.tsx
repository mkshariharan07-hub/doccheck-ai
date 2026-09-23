"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const breadcrumbMap: Record<string, string> = {
  upload: "Upload Document",
  dashboard: "Analysis Dashboard",
  editor: "Document Editor",
  report: "Analysis Report",
  results: "Results & Downloads",
};

export function Header() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="h-16 border-b bg-card flex items-center px-6 shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="w-4 h-4" />
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          const label = breadcrumbMap[segment] || segment;
          return (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              <span className={isLast ? "text-foreground font-medium" : ""}>
                {label}
              </span>
            </span>
          );
        })}
        {segments.length === 0 && (
          <span className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Home</span>
          </span>
        )}
      </div>
    </header>
  );
}
