import { z } from "zod";

export const GRADING_REVIEW_PROTOCOL = {
  personas: {
    colorist: "Develop the intended look. Assess exposure, color balance, palette and mood against the user's brief.",
    technical: "Inspect all paired frames for clipping, crushed shadows, casts, skin-tone problems and temporal consistency. Disclose checks you could not perform.",
    critic: "Independently judge whether the candidate improves the original. Challenge unnecessary changes and unnatural color; do not approve merely because it differs.",
  },
  instructions: "For single-video grading, delegate to three independent review agents, one per persona. Give each the creative brief, exact proposal and preview IDs, filter settings, and all paired images. Submit each agent's own feedback with editor_color_submit_review. Do not impersonate three reviewers. If delegation or image inspection is unavailable, report the limitation and leave the grade unapproved.",
  feedbackLoop: "On revise/reject feedback, have the colorist produce a revised candidate addressing the findings, call editor_color_propose again, capture new images, and obtain three fresh reviews. Never reuse reviews for new settings. Stop after three rounds or if progress stalls; retain the best candidate for human review rather than declaring success. Unanimous improvement is necessary, not proof of aesthetic quality.",
  identityAssurance: "Reviewer IDs are coordinator-supplied attestations, not authenticated proof of independent agents.",
} as const;

export const gradingReviewSchema = z.object({
  proposalId: z.string().min(1).max(160),
  previewId: z.string().min(1).max(160),
  persona: z.enum(["colorist", "technical", "critic"]),
  reviewerId: z.string().trim().min(1).max(128),
  verdict: z.enum(["improves", "revise", "reject"]),
  findings: z.string().trim().min(20).max(2000),
  requestedChanges: z.string().trim().min(1).max(2000),
}).strict();
export type GradingReview = z.infer<typeof gradingReviewSchema>;

export function requireThreeReviews(reviews: GradingReview[], previewId: string): void {
  const current = reviews.filter((review) => review.previewId === previewId);
  if (new Set(current.map((review) => review.persona)).size !== 3 ||
    new Set(current.map((review) => review.reviewerId)).size !== 3) {
    throw new Error("THREE_REVIEWS_REQUIRED: Submit independent colorist, technical, and critic reviews for this exact preview.");
  }
  if (current.some((review) => review.verdict !== "improves")) {
    throw new Error("GRADE_REVISION_REQUIRED: Address reviewer feedback and capture a new candidate before approval.");
  }
}
