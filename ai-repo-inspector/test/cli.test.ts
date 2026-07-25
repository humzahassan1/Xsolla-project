import { describe, expect, it } from "vitest";
import { InspectorError } from "../src/errors.js";
import { parseArgs } from "../src/cli.js";

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
