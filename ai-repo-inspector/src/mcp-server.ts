#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { InspectorError } from "./errors.js";
import {
  ALLOWED_MCP_VALIDATION_COMMANDS,
  filterAllowedMcpCommands,
  formatAllowlistError,
} from "./mcp-allowlist.js";
import { renderReport, truncateReport } from "./report.js";

const MCP_REPORT_MAX_BYTES = 50_240;

const reviewInputSchema = {
  repo_path: z.string().describe("Absolute or relative path to the git repository to inspect."),
  base_ref: z.string().optional().describe("Base git ref to compare against (defaults to origin/HEAD, main, or master)."),
  validation_commands: z
    .array(z.string())
    .optional()
    .describe(
      `Validation commands to run. Allowed values: ${ALLOWED_MCP_VALIDATION_COMMANDS.join(", ")}.`,
    ),
  format: z
    .enum(["markdown", "json"])
    .optional()
    .describe('Report format. Defaults to "markdown".'),
};

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report.",
  reviewInputSchema,
  async (input) => {
    try {
      const { allowed, disallowed } = filterAllowedMcpCommands(input.validation_commands);
      if (disallowed.length > 0) {
        return {
          isError: true,
          content: [{ type: "text", text: formatAllowlistError(disallowed) }],
        };
      }

      const result = await reviewRepository({
        repositoryPath: input.repo_path,
        baseRef: input.base_ref,
        validationCommands: allowed,
        format: input.format,
      });

      const format = input.format ?? "markdown";
      const report = truncateReport(renderReport(result, format), MCP_REPORT_MAX_BYTES);

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error) {
      const message =
        error instanceof InspectorError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unexpected error while reviewing repository.";

      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
    }
  },
);

await server.connect(new StdioServerTransport());
