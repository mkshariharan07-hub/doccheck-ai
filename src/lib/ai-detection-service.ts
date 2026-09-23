import { AIDetectionService } from "@/types";

export const aiDetectionService: AIDetectionService = {
  async detect(text: string) {
    void text;
    // Placeholder - connect real AI detection API here
    // When connected, this should return:
    // { status: 'checked', score: number, details: {...} }
    return {
      status: "pending",
      score: null,
      details: null,
    };
  },
};
