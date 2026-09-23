import { PlagiarismService } from "@/types";

export const plagiarismService: PlagiarismService = {
  async check(text: string) {
    void text;
    // Placeholder - connect real plagiarism detection API here
    // When connected, this should return:
    // { status: 'checked', score: number, details: {...} }
    return {
      status: "pending",
      score: null,
      details: null,
    };
  },
};
