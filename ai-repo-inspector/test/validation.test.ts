import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runValidation, truncateOutput } from "../src/validation.js";

describe("runValidation", () => {
  const cwd = mkdtempSync(join(tmpdir(), "inspector-validation-"));

  it("resolves with passed status for a successful command", async () => {
    const result = await runValidation('node -e "process.stdout.write(\'ok\')"', cwd);
    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("ok");
  });

  it("resolves with failed status and exit code for a failing command", async () => {
    const result = await runValidation('node -e "process.exit(3)"', cwd);
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
  });

  it("truncates oversized output", () => {
    const huge = "x".repeat(30_000);
    const truncated = truncateOutput(huge, 100);
    expect(Buffer.byteLength(truncated, "utf8")).toBeLessThanOrEqual(100);
    expect(truncated).toContain("[output truncated]");
  });
});

describe("runValidations", () => {
  it("runs all commands even when one fails", async () => {
    const { runValidations } = await import("../src/validation.js");
    const cwd = mkdtempSync(join(tmpdir(), "inspector-validation-multi-"));
    try {
      const results = await runValidations(
        ['node -e "process.exit(1)"', 'node -e "process.stdout.write(\'done\')"'],
        cwd,
      );
      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe("failed");
      expect(results[1]?.status).toBe("passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
