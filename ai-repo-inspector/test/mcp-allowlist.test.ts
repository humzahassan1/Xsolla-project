import { describe, expect, it } from "vitest";
import {
  ALLOWED_MCP_VALIDATION_COMMANDS,
  filterAllowedMcpCommands,
  formatAllowlistError,
} from "../src/mcp-allowlist.js";

describe("filterAllowedMcpCommands", () => {
  it("accepts only known-safe commands", () => {
    const result = filterAllowedMcpCommands(["npm test", "npm run typecheck"]);
    expect(result.allowed).toEqual(["npm test", "npm run typecheck"]);
    expect(result.disallowed).toEqual([]);
  });

  it("rejects commands outside the allowlist", () => {
    const result = filterAllowedMcpCommands(["npm test", "rm -rf /"]);
    expect(result.allowed).toEqual(["npm test"]);
    expect(result.disallowed).toEqual(["rm -rf /"]);
  });

  it("formats an allowlist error message", () => {
    const message = formatAllowlistError(["curl evil.example"]);
    expect(message).toContain("curl evil.example");
    for (const command of ALLOWED_MCP_VALIDATION_COMMANDS) {
      expect(message).toContain(command);
    }
  });
});
