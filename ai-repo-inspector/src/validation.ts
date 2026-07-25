import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

export const DEFAULT_VALIDATION_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_BUFFER_BYTES = 1_048_576;
export const DEFAULT_OUTPUT_CAP_BYTES = 20_480;

export function truncateOutput(output: string, maxBytes: number): string {
  if (Buffer.byteLength(output, "utf8") <= maxBytes) {
    return output;
  }

  const marker = "\n[output truncated]";
  const budget = maxBytes - Buffer.byteLength(marker, "utf8");
  let truncated = "";
  for (const char of output) {
    const next = truncated + char;
    if (Buffer.byteLength(next, "utf8") > budget) {
      break;
    }
    truncated = next;
  }
  return truncated + marker;
}

export function runValidation(
  command: string,
  cwd: string,
  options: {
    timeoutMs?: number;
    maxBufferBytes?: number;
    outputCapBytes?: number;
  } = {},
): Promise<ValidationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
  const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  const outputCapBytes = options.outputCapBytes ?? DEFAULT_OUTPUT_CAP_BYTES;

  return new Promise((resolve) => {
    exec(
      command,
      { cwd, timeout: timeoutMs, maxBuffer: maxBufferBytes },
      (error, stdout, stderr) => {
        const combined = [stdout, stderr].filter(Boolean).join("\n").trimEnd();
        const timedOut = Boolean(error && "killed" in error && error.killed);
        const exitCode =
          error && typeof error.code === "number" ? error.code : timedOut ? -1 : 0;
        const failed = Boolean(error);
        const output = truncateOutput(
          timedOut
            ? `Command timed out after ${timeoutMs}ms`
            : failed
              ? combined || error?.message || `Command failed with exit code ${exitCode}`
              : combined,
          outputCapBytes,
        );

        resolve({
          command,
          status: failed ? "failed" : "passed",
          output,
          exitCode: failed ? exitCode : 0,
        });
      },
    );
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
