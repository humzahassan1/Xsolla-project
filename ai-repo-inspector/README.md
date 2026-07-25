# Repository Inspector

This is a small TypeScript developer tool that inspects changes in a Git
repository, runs optional validation commands, and produces a Markdown or JSON
report. It can be used from a command line or exposed to AI clients through MCP.

Both interfaces are thin adapters over a shared core (`src/core.ts`) so behavior
stays consistent regardless of how the tool is invoked.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## CLI

```bash
npm run inspector -- review --repo ./path/to/repo
npm run inspector -- review --repo "./path with spaces" --base-ref main --validate "npm test"
npm run inspector -- review --repo ./path/to/repo --format json --output ./out/report.json
```

### Flags

| Flag | Description |
| --- | --- |
| `--repo <path>` | Repository to inspect (required). Paths with spaces are supported. |
| `--base-ref <ref>` | Base ref for `git diff`. Verified with `git rev-parse --verify`. |
| `--validate <command>` | Validation command to run. Repeatable. Free-form on the CLI. |
| `--format markdown\|json` | Output format. Defaults to `markdown`. |
| `--output <path>` | Output file path. Defaults to `review-report.md` or `review-report.json`. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Review completed and all validations passed. |
| `1` | Usage error or inspector error (not a repo, unknown ref, etc.). |
| `2` | Review completed but at least one validation failed (CI-friendly). |

Inspector errors are printed as one-line messages without stack traces.

### Base ref resolution

When `--base-ref` is omitted, the core resolves a base ref in this order:

1. `origin/HEAD`
2. `main`
3. `master`

If none exist, the command fails with a clear error.

Changed files include tracked diffs (`added`, `modified`, `deleted`, `renamed`)
plus untracked files from `git ls-files --others --exclude-standard`.

## MCP

Start the stdio server with:

```bash
npm run mcp-server
```

### Tool: `review_repository`

| Field | Type | Description |
| --- | --- | --- |
| `repo_path` | `string` | Repository path to inspect. |
| `base_ref` | `string?` | Optional base ref (same resolution rules as CLI). |
| `validation_commands` | `string[]?` | Optional validation commands (allowlisted only). |
| `format` | `"markdown" \| "json"?` | Report format. Defaults to `markdown`. |

Example input:

```json
{
  "repo_path": "/workspace/my-repo",
  "base_ref": "main",
  "validation_commands": ["npm test", "npm run typecheck"],
  "format": "markdown"
}
```

### MCP validation allowlist

The MCP adapter enforces a trust boundary: AI clients may only request these
commands:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Any other command returns `isError: true` with a message listing allowed
commands. The CLI keeps free-form `--validate` because a human already has shell
access.

### MCP error handling

Expected failures (not a repo, unknown ref, disallowed command) and unexpected
errors return structured `isError: true` text responses instead of crashing the
server loop. Reports are capped at ~50 KB with a truncation notice.

## Project layout

```text
src/core.ts           shared review orchestration
src/cli.ts            command-line adapter
src/mcp-server.ts     MCP adapter
src/mcp-allowlist.ts  MCP validation allowlist helper
src/git.ts            Git inspection
src/validation.ts     validation execution
src/report.ts         report rendering (markdown + JSON)
src/errors.ts         typed inspector errors
test/                 unit tests
```

## Your task

Investigate the repository and improve it as you judge best. The starter works
for a narrow happy path, but production use may expose correctness, safety,
reliability, contract, output, documentation, or testing weaknesses.

You are not expected to finish everything. We care about how you investigate,
prioritize, implement, verify, and explain a meaningful scope.

## Product decision

This tool may be used directly by developers and by AI coding agents. Decide
whether its production interface should be **CLI-first**, **MCP-first**, or
**hybrid**. Implement improvements consistent with your decision.

There is no preferred label. Explain:

- The primary user and execution environment you assumed.
- The trust boundary and allowed capabilities.
- Reliability, discoverability, latency/context, and output-size tradeoffs.
- How the interfaces you continue to advertise stay behaviorally consistent.
- What evidence would change your decision.

## Time and rules

- Maximum **90 focused minutes** within 48 hours of receiving the invitation.
- Use AI coding tools freely. Verify their work and document at least one
  suggestion you corrected or rejected.
- Work in your own repository created from this template.
- Commit as you work and complete `SUBMISSION.md` in your final commit.
- Completion is not required. Accurate scope and verification matter more than
  a large diff.

When finished, reply with your repository URL.
