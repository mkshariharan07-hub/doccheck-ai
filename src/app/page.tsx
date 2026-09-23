"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  FileText,
  SpellCheck,
  FileEdit,
  Shield,
  Zap,
  ArrowRight,
} from "lucide-react";
import { MotionButton } from "@/components/animated/MotionButton";
import { AnimatedCard } from "@/components/animated/AnimatedCard";
import { AnimatedContainer, AnimatedItem } from "@/components/animated/AnimatedContainer";

const features = [
  {
    icon: SpellCheck,
    title: "Grammar & Spelling",
    description:
      "Detect and fix grammar, spelling, punctuation, and style issues automatically.",
  },
  {
    icon: FileEdit,
    title: "Side-by-Side Editor",
    description:
      "Review corrections with an intuitive comparison view. Apply or ignore each suggestion.",
  },
  {
    icon: FileText,
    title: "DOCX & PDF Support",
    description:
      "Upload Word documents and PDFs. Download revised DOCX files and PDF analysis reports.",
  },
  {
    icon: Shield,
    title: "Plagiarism Detection",
    description:
      "Architecture ready for plagiarism API integration. Connect your preferred service.",
  },
  {
    icon: Zap,
    title: "AI Detection",
    description:
      "Placeholder for AI content detection. Ready to connect when you choose a provider.",
  },
  {
    icon: FileText,
    title: "Professional Reports",
    description:
      "Generate detailed PDF analysis reports with complete findings and statistics.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="w-3.5 h-3.5" />
              AI-Powered Document Analysis
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              DocCheck{" "}
              <span className="text-primary">AI</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Upload your documents. Get instant grammar, spelling, and style
              analysis. Download corrected versions and professional reports.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/upload">
                <MotionButton size="lg" className="gap-2">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </MotionButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Everything you need
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Complete document analysis toolkit. Upload, analyze, correct, and
            download — all in one place.
          </p>
        </motion.div>

        <AnimatedContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <AnimatedItem key={feature.title}>
              <AnimatedCard className="p-6 h-full">
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </AnimatedCard>
            </AnimatedItem>
          ))}
        </AnimatedContainer>
      </div>

      {/* CTA */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <AnimatedCard className="p-12 text-center bg-primary text-primary-foreground">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to improve your documents?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Upload a DOCX or PDF file to get instant analysis and corrections.
          </p>
          <Link href="/upload">
            <MotionButton
              variant="secondary"
              size="lg"
              className="gap-2 bg-white text-foreground hover:bg-white/90"
            >
              Upload Document
              <ArrowRight className="w-4 h-4" />
            </MotionButton>
          </Link>
        </AnimatedCard>
      </div>
    </div>
  );
}
