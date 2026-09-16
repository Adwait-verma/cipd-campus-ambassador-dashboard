export type SubmissionProgressData = {
  is_verified: boolean;
  fetched_at: string | null;
  ambassador_status: string;
  rating_calculated_at: string | null;
  latest_campaign_metrics_at: string | null;
};

export function submissionProgress(submission: SubmissionProgressData | null) {
  if (!submission) return {
    stage: 0,
    title: "No post submitted",
    detail: "Read the brief, publish your campaign post and submit its direct URL.",
  };
  if (!submission.is_verified || !submission.fetched_at) return {
    stage: 1,
    title: "Awaiting metric verification",
    detail: "Your post is submitted. An administrator must verify it and save its metrics before it can be rated.",
  };
  if (submission.ambassador_status !== "ACTIVE") return {
    stage: 2,
    title: "Verified · eligibility required",
    detail: "Your metrics are verified, but your ambassador profile must be ACTIVE to enter the rating calculation. Check Social Accounts or contact the administrator.",
  };
  const calculatedAt = submission.rating_calculated_at;
  const metricsAt = submission.latest_campaign_metrics_at ?? submission.fetched_at;
  if (!calculatedAt || Date.parse(metricsAt) > Date.parse(calculatedAt)) return {
    stage: 2,
    title: calculatedAt ? "Verified · awaiting recalculation" : "Verified · awaiting rating calculation",
    detail: "An administrator must open this campaign and click Recalculate Ratings. Social account verification and metric verification do not calculate ratings automatically.",
  };
  return {
    stage: 3,
    title: "Rated",
    detail: "A campaign rating has been calculated from verified metrics. Your campaign rating is shown below; Performance shows your latest calculated campaign rating.",
  };
}
