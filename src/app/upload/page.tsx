"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { formatFileSize, validateFileType, validateFileSize } from "@/lib/file-utils";

type UploadStatus = "idle" | "validating" | "uploading" | "parsing" | "analyzing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (!selected) return;

    setError(null);

    if (!validateFileType(selected)) {
      setError("Invalid file type. Please upload a DOCX or PDF file.");
      return;
    }

    if (!validateFileSize(selected)) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    setFile(selected);
    setStatus("idle");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setProgress(0);
  };

  const startUpload = async () => {
    if (!file) return;

    setStatus("validating");
    setProgress(10);

    // Short pause so the validating state is visible before the request starts
    await new Promise((resolve) => setTimeout(resolve, 350));

    setStatus("uploading");
    setProgress(15);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(15 + (event.loaded / event.total) * 65);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        setStatus("done");
        try {
          const data = JSON.parse(xhr.responseText);
          setTimeout(() => {
            router.push(`/dashboard/${data.document.id}`);
          }, 1000);
        } catch {
          setStatus("error");
          setError("Invalid server response");
          setProgress(0);
        }
      } else {
        let message = "Upload failed";
        try {
          message = JSON.parse(xhr.responseText).error || message;
        } catch {
          // fall back to the default message
        }
        setStatus("error");
        setError(message);
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      setStatus("error");
      setError("Network error. Please try again.");
      setProgress(0);
    };

    xhr.send(formData);
  };

  const statusMessages: Record<UploadStatus, string> = {
    idle: "",
    validating: "Validating file...",
    uploading: "Uploading document...",
    parsing: "Extracting text...",
    analyzing: "Running grammar analysis...",
    done: "Analysis complete! Redirecting...",
    error: "Upload failed",
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Upload Document</h1>
        <p className="text-muted-foreground">
          Upload a DOCX or PDF file to analyze for grammar, spelling, and style
          issues.
        </p>
      </motion.div>

      <AnimatedCard delay={0.1} hover={false} className="p-8">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  animate={isDragActive ? { scale: 1.05, y: -5 } : { scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    {isDragActive
                      ? "Drop your document here"
                      : "Drag & drop your document here"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports DOCX and PDF • Max 10MB
                  </p>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* File Info */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} •{" "}
                    {file.name.endsWith(".docx") ? "Word Document" : "PDF"}
                  </p>
                </div>
                {status === "idle" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    className="shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                {status === "done" && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                )}
              </div>

              {/* Progress */}
              {(status === "validating" ||
                status === "uploading" ||
                status === "parsing" ||
                status === "analyzing") && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      {statusMessages[status]}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Error */}
              {status === "error" && error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Actions */}
              {status === "idle" && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={removeFile}
                    className="flex-1 cursor-pointer"
                  >
                    Choose Different File
                  </Button>
                  <Button
                    onClick={startUpload}
                    className="flex-1 gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload & Analyze
                  </Button>
                </div>
              )}

              {status === "done" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 justify-center text-green-600"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">
                    Redirecting to dashboard...
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedCard>

      {/* Supported formats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 grid grid-cols-2 gap-4"
      >
        <AnimatedCard delay={0.3} className="p-4 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">DOCX</p>
          <p className="text-xs text-muted-foreground">
            Microsoft Word documents
          </p>
        </AnimatedCard>
        <AnimatedCard delay={0.4} className="p-4 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">PDF</p>
          <p className="text-xs text-muted-foreground">PDF documents</p>
        </AnimatedCard>
      </motion.div>
    </div>
  );
}
