#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { reviewRepository } from "./core.js";
import { InspectorError } from "./errors.js";
import { renderReport } from "./report.js";
import type { ReportFormat } from "./types.js";

export type ParsedCliArgs = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format: ReportFormat;
  outputPath?: string;
  validations: string[];
};

export function parseArgs(argv: string[]): ParsedCliArgs {
  const args: ParsedCliArgs = {
    command: argv[0] ?? "",
    validations: [],
    format: "markdown",
  };

  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];

    if (token === "--repo") {
      const value = argv[++index];
      if (!value) {
        throw new InspectorError("usage", "Missing value for --repo.");
      }
      args.repositoryPath = value;
      continue;
    }

    if (token === "--base-ref") {
      const value = argv[++index];
      if (!value) {
        throw new InspectorError("usage", "Missing value for --base-ref.");
      }
      args.baseRef = value;
      continue;
    }

    if (token === "--format") {
      const value = argv[++index];
      if (!value) {
        throw new InspectorError("usage", "Missing value for --format.");
      }
      if (value !== "markdown" && value !== "json") {
        throw new InspectorError("usage", 'Invalid --format value. Use "markdown" or "json".');
      }
      args.format = value;
      continue;
    }

    if (token === "--output") {
      const value = argv[++index];
      if (!value) {
        throw new InspectorError("usage", "Missing value for --output.");
      }
      args.outputPath = value;
      continue;
    }

    if (token === "--validate") {
      const value = argv[++index];
      if (!value) {
        throw new InspectorError("usage", "Missing value for --validate.");
      }
      args.validations.push(value);
      continue;
    }

    throw new InspectorError("usage", `Unknown argument: ${token}`);
  }

  return args;
}

function defaultOutputPath(format: ReportFormat): string {
  return format === "json" ? "review-report.json" : "review-report.md";
}

function printUsage(): void {
  console.error(
    'Usage: inspector review --repo <path> [--base-ref <ref>] [--format markdown|json] [--output <path>] [--validate <command>]',
  );
}

export async function runCli(argv: string[]): Promise<number> {
  let args: ParsedCliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof InspectorError) {
      console.error(error.message);
      printUsage();
      return 1;
    }
    throw error;
  }

  if (args.command !== "review" || !args.repositoryPath) {
    printUsage();
    return 1;
  }

  try {
    const result = await reviewRepository({
      repositoryPath: args.repositoryPath,
      baseRef: args.baseRef,
      validationCommands: args.validations,
      format: args.format,
    });

    const report = renderReport(result, args.format);
    const outputPath = args.outputPath ?? defaultOutputPath(args.format);
    writeFileSync(outputPath, report, "utf8");
    console.log(`Review report written to ${outputPath}`);

    return result.ok ? 0 : 2;
  } catch (error) {
    if (error instanceof InspectorError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

if (!process.env.VITEST) {
  main().catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
