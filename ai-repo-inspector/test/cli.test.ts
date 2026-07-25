import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InspectorError } from "../src/errors.js";
import { parseArgs, runCli } from "../src/cli.js";

describe("parseArgs", () => {
  it("preserves repository paths that contain spaces", () => {
    const args = parseArgs(["review", "--repo", "/tmp/my repo", "--validate", "npm test"]);
    expect(args.repositoryPath).toBe("/tmp/my repo");
    expect(args.validations).toEqual(["npm test"]);
  });

  it("accepts multiple --validate flags", () => {
    const args = parseArgs([
      "review",
      "--repo",
      ".",
      "--validate",
      "npm test",
      "--validate",
      "npm run lint",
    ]);
    expect(args.validations).toEqual(["npm test", "npm run lint"]);
  });

  it("throws when a flag is missing its value", () => {
    expect(() => parseArgs(["review", "--repo"])).toThrow(InspectorError);
    expect(() => parseArgs(["review", "--repo", ".", "--format"])).toThrow(/Missing value for --format/);
  });

  it("rejects unsupported format values", () => {
    expect(() => parseArgs(["review", "--repo", ".", "--format", "xml"])).toThrow(
      /Invalid --format value/,
    );
  });
});

describe("runCli", () => {
  let repoDir: string;
  let outDir: string;

  function runGit(args: string[]): void {
    execFileSync("git", args, { cwd: repoDir, encoding: "utf8" });
  }

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "inspector-cli-repo-"));
    outDir = mkdtempSync(join(tmpdir(), "inspector-cli-out-"));
    runGit(["init", "-b", "main"]);
    runGit(["config", "user.email", "test@example.com"]);
    runGit(["config", "user.name", "Test User"]);
    writeFileSync(join(repoDir, "a.txt"), "base\n", "utf8");
    runGit(["add", "."]);
    runGit(["commit", "-m", "base"]);
    runGit(["checkout", "-b", "feature"]);
    writeFileSync(join(repoDir, "a.txt"), "changed\n", "utf8");
    runGit(["commit", "-am", "change"]);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  it("writes the report and exits 0 on success", async () => {
    const outputPath = join(outDir, "report.md");
    const exitCode = await runCli([
      "review",
      "--repo",
      repoDir,
      "--base-ref",
      "main",
      "--output",
      outputPath,
    ]);

    expect(exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, "utf8")).toContain("a.txt (modified)");
  });

  it("exits 2 when a validation command fails", async () => {
    const outputPath = join(outDir, "report.md");
    const exitCode = await runCli([
      "review",
      "--repo",
      repoDir,
      "--base-ref",
      "main",
      "--validate",
      'node -e "process.exit(1)"',
      "--output",
      outputPath,
    ]);

    expect(exitCode).toBe(2);
    expect(readFileSync(outputPath, "utf8")).toContain("[failed, exit 1]");
  });

  it("exits 1 with no report on usage and inspector errors", async () => {
    const outputPath = join(outDir, "report.md");
    expect(await runCli(["review"])).toBe(1);
    expect(
      await runCli(["review", "--repo", outDir, "--output", outputPath]),
    ).toBe(1);
    expect(existsSync(outputPath)).toBe(false);
  });
});
