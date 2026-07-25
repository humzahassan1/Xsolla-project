import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InspectorError } from "../src/errors.js";
import { changedFiles, resolveBaseRef } from "../src/git.js";

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo(dir: string): void {
  runGit(dir, ["init", "-b", "main"]);
  runGit(dir, ["config", "user.email", "test@example.com"]);
  runGit(dir, ["config", "user.name", "Test User"]);
}

describe("changedFiles", () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "inspector-git-"));
    initRepo(repoDir);
    writeFileSync(join(repoDir, "README.md"), "base\n", "utf8");
    writeFileSync(join(repoDir, "keep.txt"), "keep\n", "utf8");
    writeFileSync(join(repoDir, "remove-me.txt"), "remove\n", "utf8");
    runGit(repoDir, ["add", "."]);
    runGit(repoDir, ["commit", "-m", "base"]);
    runGit(repoDir, ["checkout", "-b", "feature"]);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("reports added, modified, deleted, renamed, and untracked files", () => {
    writeFileSync(join(repoDir, "added.txt"), "new\n", "utf8");
    writeFileSync(join(repoDir, "README.md"), "changed\n", "utf8");
    runGit(repoDir, ["mv", "keep.txt", "renamed.txt"]);
    runGit(repoDir, ["rm", "remove-me.txt"]);
    writeFileSync(join(repoDir, "untracked.txt"), "secret\n", "utf8");
    runGit(repoDir, ["add", "added.txt", "README.md", "renamed.txt"]);
    runGit(repoDir, ["commit", "-m", "feature changes"]);

    const files = changedFiles(repoDir, "main");
    const byPath = Object.fromEntries(files.map((file) => [file.path, file.status]));

    expect(byPath["added.txt"]).toBe("added");
    expect(byPath["README.md"]).toBe("modified");
    expect(byPath["renamed.txt"]).toBe("renamed");
    expect(byPath["remove-me.txt"]).toBe("deleted");
    expect(byPath["untracked.txt"]).toBe("untracked");
  });

  it("throws a clear error for a non-repository path", () => {
    const notARepo = mkdtempSync(join(tmpdir(), "inspector-not-repo-"));
    try {
      expect(() => changedFiles(notARepo, "main")).toThrow(/Not a git repository/);
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });

  it("throws when the base ref does not exist", () => {
    expect(() => resolveBaseRef(repoDir, "does-not-exist")).toThrow(/Unknown base ref/);
  });

  it("throws when the base ref shares no merge base with HEAD", () => {
    runGit(repoDir, ["checkout", "--orphan", "other"]);
    writeFileSync(join(repoDir, "orphan.txt"), "orphan\n", "utf8");
    runGit(repoDir, ["add", "orphan.txt"]);
    runGit(repoDir, ["commit", "-m", "orphan root"]);
    runGit(repoDir, ["checkout", "feature"]);

    expect(() => changedFiles(repoDir, "other")).toThrow(InspectorError);
    expect(() => changedFiles(repoDir, "other")).toThrow(/no merge base/i);
  });
});

describe("resolveBaseRef via changedFiles", () => {
  it("falls back to main when base ref is omitted", () => {
    const repoDir = mkdtempSync(join(tmpdir(), "inspector-default-base-"));
    try {
      initRepo(repoDir);
      writeFileSync(join(repoDir, "file.txt"), "hello\n", "utf8");
      runGit(repoDir, ["add", "file.txt"]);
      runGit(repoDir, ["commit", "-m", "initial"]);
      runGit(repoDir, ["checkout", "-b", "feature"]);
      writeFileSync(join(repoDir, "file.txt"), "changed\n", "utf8");
      runGit(repoDir, ["commit", "-am", "change"]);

      const files = changedFiles(repoDir, "main");
      expect(files.some((file) => file.path === "file.txt" && file.status === "modified")).toBe(
        true,
      );
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});
