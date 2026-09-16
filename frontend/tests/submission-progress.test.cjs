const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/submission-progress.ts"), "utf8");
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const progress = context.exports.submissionProgress;
const verified = {
  is_verified: true,
  fetched_at: "2026-09-09T10:00:00Z",
  ambassador_status: "ACTIVE",
  rating_calculated_at: null,
  latest_campaign_metrics_at: "2026-09-09T10:00:00Z",
};

test("no submission has no completed stages", () => {
  assert.equal(progress(null).stage, 0);
});
test("an unverified post or missing snapshot waits for metric verification", () => {
  assert.equal(progress({ ...verified, is_verified: false }).stage, 1);
  assert.equal(progress({ ...verified, fetched_at: null }).stage, 1);
});
test("verified metrics without a campaign rating await calculation", () => {
  const result = progress(verified);
  assert.equal(result.stage, 2);
  assert.match(result.title, /awaiting rating calculation/);
});
test("a rating calculated after verified metrics completes the workflow", () => {
  assert.equal(progress({ ...verified, rating_calculated_at: "2026-09-09T11:00:00Z" }).stage, 3);
});
test("new campaign metrics make an older rating await recalculation", () => {
  const result = progress({
    ...verified,
    rating_calculated_at: "2026-09-09T11:00:00Z",
    latest_campaign_metrics_at: "2026-09-09T12:00:00Z",
  });
  assert.equal(result.stage, 2);
  assert.match(result.title, /recalculation/);
});
test("a stored rating cannot bypass inactive ambassador eligibility", () => {
  const result = progress({ ...verified, ambassador_status: "PENDING", rating_calculated_at: "2026-09-09T11:00:00Z" });
  assert.equal(result.stage, 2);
  assert.match(result.title, /eligibility/);
});
