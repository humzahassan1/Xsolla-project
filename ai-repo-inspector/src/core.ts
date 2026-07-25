import { InspectorError } from "./errors.js";
import { changedFiles, resolveBaseRef } from "./git.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest): Promise<ReviewResult> {
  const baseRef = resolveBaseRef(request.repositoryPath, request.baseRef);
  const files = changedFiles(request.repositoryPath, baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );
  const ok = validations.every((result) => result.status === "passed");

  return {
    repositoryPath: request.repositoryPath,
    baseRef,
    changedFiles: files,
    validationResults: validations,
    ok,
  };
}

export function assertReviewRequest(request: ReviewRequest): void {
  if (!request.repositoryPath) {
    throw new InspectorError("usage", "Repository path is required.");
  }
}
