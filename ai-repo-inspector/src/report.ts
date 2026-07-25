import { truncateWithMarker } from "./text.js";
import type { ReportFormat, ReviewResult } from "./types.js";

export function renderReport(result: ReviewResult, format: ReportFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }
  return markdownReport(result);
}

export function markdownReport(result: ReviewResult): string {
  const lines = [
    `# Review Report: ${result.repositoryPath}`,
    "",
    `Base ref: ${result.baseRef}`,
    "",
    "## Changed files",
  ];

  if (result.changedFiles.length === 0) {
    lines.push("- (none)");
  } else {
    for (const file of result.changedFiles) {
      lines.push(`- ${file.path} (${file.status})`);
    }
  }

  lines.push("", "## Validation output");
  if (result.validationResults.length === 0) {
    lines.push("- (none)");
  } else {
    for (const validation of result.validationResults) {
      lines.push(
        `### ${validation.command} [${validation.status}, exit ${validation.exitCode}]`,
        "```",
        validation.output || "(no output)",
        "```",
      );
    }
  }

  return lines.join("\n");
}

export function truncateReport(text: string, maxBytes: number): string {
  return truncateWithMarker(text, maxBytes, "\n\n[report truncated]");
}
