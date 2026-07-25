import { describe, expect, it } from "vitest";
import { markdownReport, renderReport, truncateReport } from "../src/report.js";
import type { ReviewResult } from "../src/types.js";

const sampleResult: ReviewResult = {
  repositoryPath: "/work/sample",
  baseRef: "main",
  changedFiles: [{ path: "src/index.ts", status: "modified" }],
  validationResults: [
    { command: "npm test", status: "passed", output: "ok", exitCode: 0 },
    { command: "npm run lint", status: "failed", output: "lint failed", exitCode: 1 },
  ],
  ok: false,
};

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport(sampleResult);
    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
    expect(report).toContain("exit 1");
  });
});

describe("renderReport", () => {
  it("renders markdown by default", () => {
    const report = renderReport(sampleResult, "markdown");
    expect(report).toContain("# Review Report");
  });

  it("truncates oversized reports with a marker", () => {
    const huge = "x".repeat(30_000);
    const truncated = truncateReport(huge, 100);
    expect(Buffer.byteLength(truncated, "utf8")).toBeLessThanOrEqual(100);
    expect(truncated).toContain("[report truncated]");
    expect(truncateReport("short", 100)).toBe("short");
  });

  it("renders JSON and round-trips core fields", () => {
    const report = renderReport(sampleResult, "json");
    const parsed = JSON.parse(report) as ReviewResult;
    expect(parsed.repositoryPath).toBe(sampleResult.repositoryPath);
    expect(parsed.baseRef).toBe("main");
    expect(parsed.changedFiles).toEqual(sampleResult.changedFiles);
    expect(parsed.validationResults[1]?.exitCode).toBe(1);
    expect(parsed.ok).toBe(false);
  });
});
