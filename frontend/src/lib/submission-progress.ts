export type SubmissionProgressData = {
  is_verified: boolean;
  fetched_at: string | null;
  ambassador_status: string;
  rating_calculated_at: string | null;
  latest_campaign_metrics_at: string | null;
  campaign_finalized_at?: string | null;
};

export function submissionProgress(submission: SubmissionProgressData | null) {
  if (!submission) return {
    stage: 0,
    title: "No post submitted",
    detail: "Read the brief, publish your campaign post and submit its direct URL.",
  };
  if (submission.campaign_finalized_at && (!submission.is_verified || !submission.fetched_at || !submission.rating_calculated_at)) return {
    stage: 1,
    title: "Campaign closed · submission not scored",
    detail: "This submission had no complete eligible metrics before closing. Campaign results are now fixed; contact programme support if you need clarification.",
  };
  if (!submission.is_verified || !submission.fetched_at) return {
    stage: 1,
    title: "Awaiting Instagram metrics",
    detail: "Your post is submitted. Instagram metrics will be fetched automatically on the schedule shown above. Reconnect Instagram if the connection fails.",
  };
  if (submission.campaign_finalized_at && submission.rating_calculated_at) return {
    stage: 3,
    title: "Final campaign result",
    detail: "This campaign has closed. Its ranking and star awards are fixed; your historical result remains available in Performance.",
  };
  if (submission.ambassador_status !== "ACTIVE") return {
    stage: 2,
    title: "Verified · eligibility required",
    detail: "Your metrics are available, but your ambassador profile must be ACTIVE to enter new campaign calculations. Connect Instagram or contact programme support.",
  };
  const calculatedAt = submission.rating_calculated_at;
  const metricsAt = submission.latest_campaign_metrics_at ?? submission.fetched_at;
  if (!calculatedAt || Date.parse(metricsAt) > Date.parse(calculatedAt)) return {
    stage: 2,
    title: calculatedAt ? "Verified · awaiting recalculation" : "Verified · awaiting rating calculation",
    detail: "Your metrics are available. Changed metrics automatically update the campaign ranking after the sync batch. Check Performance after the next update.",
  };
  return {
    stage: 3,
    title: "Rated",
    detail: "Your campaign result is available. Performance shows campaign and overall rankings; this campaign result becomes fixed after closing.",
  };
}
