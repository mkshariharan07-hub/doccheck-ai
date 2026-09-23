"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Upload,
  LayoutDashboard,
  FileEdit,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function readLastDocumentId(): string | null {
  try {
    return localStorage.getItem("doccheck:last-document");
  } catch {
    return null;
  }
}

let lastDocumentIdCache: string | null | undefined;
const lastDocumentIdListeners = new Set<() => void>();

function subscribeLastDocumentId(callback: () => void) {
  lastDocumentIdListeners.add(callback);
  return () => {
    lastDocumentIdListeners.delete(callback);
  };
}

function getLastDocumentIdSnapshot() {
  const id = readLastDocumentId();
  if (id !== lastDocumentIdCache) {
    lastDocumentIdCache = id;
    lastDocumentIdListeners.forEach((listener) => listener());
  }
  return lastDocumentIdCache ?? null;
}

function getLastDocumentIdServerSnapshot() {
  return null;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const storedDocId = useSyncExternalStore(
    subscribeLastDocumentId,
    getLastDocumentIdSnapshot,
    getLastDocumentIdServerSnapshot
  );

  const lastDocumentId = useMemo(() => {
    const match = pathname.match(/\/(dashboard|editor|report|results)\/([^/]+)/);
    if (match && match[2]) return match[2];
    return storedDocId;
  }, [pathname, storedDocId]);

  const documentHref = (route: string) =>
    lastDocumentId ? `/${route}/${lastDocumentId}` : null;

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/upload", label: "Upload", icon: Upload },
    { href: documentHref("dashboard"), label: "Dashboard", icon: LayoutDashboard },
    { href: documentHref("editor"), label: "Editor", icon: FileEdit },
    { href: documentHref("report"), label: "Report", icon: FileText },
    { href: documentHref("results"), label: "Results", icon: Download },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative flex h-full flex-col border-r bg-card overflow-hidden shrink-0"
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b">
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: collapsed ? 360 : 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0"
        >
          <FileCheck className="w-5 h-5" />
        </motion.div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="font-semibold text-lg whitespace-nowrap"
            >
              DocCheck AI
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = item.href ? isActive(item.href) : false;
          const inner = (
            <motion.div
              whileHover={item.href ? { x: 2 } : undefined}
              whileTap={item.href ? { scale: 0.98 } : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                item.href
                  ? active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "text-muted-foreground/60 cursor-not-allowed select-none"
              )}
              title={item.href ? undefined : "Upload a document first"}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );

          if (!item.href) {
            return <div key={item.label}>{inner}</div>;
          }

          return (
            <Link key={item.label} href={item.href}>
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
