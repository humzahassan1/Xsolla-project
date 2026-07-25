import { execFileSync } from "node:child_process";
import { InspectorError } from "./errors.js";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitStderrFirstLine(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") {
    const line = error.stderr.trim().split("\n").find(Boolean);
    if (line) {
      return line;
    }
  }
  if (error instanceof Error) {
    const fatal = error.message.match(/fatal: [^\n]+/);
    if (fatal) {
      return fatal[0];
    }
    return error.message;
  }
  return "Git command failed";
}

function tryGit(repositoryPath: string, args: string[]): { ok: true; output: string } | { ok: false } {
  try {
    return { ok: true, output: git(repositoryPath, args) };
  } catch {
    return { ok: false };
  }
}

function runGitDiff(repositoryPath: string, baseRef: string): string {
  try {
    return git(repositoryPath, ["diff", "--name-status", `${baseRef}...HEAD`]);
  } catch (error) {
    const mergeBaseCheck = tryGit(repositoryPath, ["merge-base", baseRef, "HEAD"]);
    if (!mergeBaseCheck.ok) {
      throw new InspectorError(
        "unknown-ref",
        `No merge base between "${baseRef}" and HEAD in ${repositoryPath}. Pass --base-ref explicitly; shallow clones may need "git fetch --unshallow".`,
      );
    }

    throw new InspectorError(
      "unknown-ref",
      `${gitStderrFirstLine(error)} in ${repositoryPath}`,
    );
  }
}

function assertGitRepository(repositoryPath: string): void {
  try {
    const insideWorkTree = git(repositoryPath, ["rev-parse", "--is-inside-work-tree"]);
    if (insideWorkTree !== "true") {
      throw new InspectorError("not-a-repo", `Not a git repository: ${repositoryPath}`);
    }
  } catch (error) {
    if (error instanceof InspectorError) {
      throw error;
    }
    throw new InspectorError("not-a-repo", `Not a git repository: ${repositoryPath}`);
  }
}

function refExists(repositoryPath: string, ref: string): boolean {
  try {
    git(repositoryPath, ["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

export function resolveBaseRef(repositoryPath: string, requestedBaseRef?: string): string {
  assertGitRepository(repositoryPath);

  if (requestedBaseRef) {
    if (!refExists(repositoryPath, requestedBaseRef)) {
      throw new InspectorError(
        "unknown-ref",
        `Unknown base ref "${requestedBaseRef}" in ${repositoryPath}`,
      );
    }
    return requestedBaseRef;
  }

  const candidates = ["origin/HEAD", "main", "master"];
  for (const candidate of candidates) {
    if (refExists(repositoryPath, candidate)) {
      return candidate;
    }
  }

  throw new InspectorError(
    "unknown-ref",
    `Could not resolve base ref (tried origin/HEAD, main, master) in ${repositoryPath}`,
  );
}

function parseNameStatusLine(line: string): ChangedFile | null {
  const tabParts = line.split("\t");
  if (tabParts.length < 2) {
    return null;
  }

  const code = tabParts[0];
  const statusLetter = code[0];

  if (statusLetter === "R" || statusLetter === "C") {
    const newPath = tabParts[tabParts.length - 1];
    return {
      path: newPath,
      status: statusLetter === "R" ? "renamed" : "added",
    };
  }

  const path = tabParts.slice(1).join("\t");
  const status =
    statusLetter === "A"
      ? "added"
      : statusLetter === "D"
        ? "deleted"
        : statusLetter === "M" || statusLetter === "T"
          ? "modified"
          : "modified";

  return { path, status };
}

function trackedChanges(repositoryPath: string, baseRef: string): ChangedFile[] {
  const output = runGitDiff(repositoryPath, baseRef);
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .filter(Boolean)
    .map(parseNameStatusLine)
    .filter((file): file is ChangedFile => file !== null);
}

function untrackedChanges(repositoryPath: string): ChangedFile[] {
  const output = git(repositoryPath, ["ls-files", "--others", "--exclude-standard"]);
  if (!output) {
    return [];
  }

  return output.split("\n").filter(Boolean).map((path) => ({
    path,
    status: "untracked" as const,
  }));
}

export function changedFiles(repositoryPath: string, baseRef: string): ChangedFile[] {
  assertGitRepository(repositoryPath);
  return [...trackedChanges(repositoryPath, baseRef), ...untrackedChanges(repositoryPath)];
}
