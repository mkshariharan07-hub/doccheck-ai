"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MotionButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}

export function MotionButton({
  children,
  className,
  ...props
}: MotionButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="inline-flex"
    >
      <Button className={cn("cursor-pointer", className)} {...props}>
        {children}
      </Button>
    </motion.div>
  );
}
