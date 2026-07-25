# Submission

## What did you investigate first, and why?

I started by reading all seven source and test files end to end. The codebase is small
enough that a full read beats sampling. Then I ran `npm run typecheck` and `npm test` to
confirm the starter's baseline was green, so if anything broke later I would know it was
my change. The read-through surfaced the defects pretty quickly, and I ranked them by
severity before writing any code:

1. **MCP contract bug** (`src/mcp-server.ts`): the zod schema declared `repo_path` but the
   handler read `input.repoPath`, so every MCP call ran with `repositoryPath: undefined`.
   Verified empirically: the server didn't error, `cwd: undefined` falls back to the server
   process's own working directory, so it silently returned a plausible-looking empty report
   (`# Review Report: undefined`) for any repo an agent asked about. Silent wrong answers
   are worse than crashes, so this ranked first.
2. **Failing validations crashed the whole review** (`src/validation.ts`): `reject(error)`
   on non-zero exit meant one failing `--validate` command produced `Fatal error` and no
   report, and the `status: "failed"` variant in `types.ts` was unreachable dead code. A
   failing test suite is the primary reason to run this tool.
3. **`--repo` truncated at the first space** (`src/cli.ts`): `argv[++index]?.split(" ")[0]`
   broke any path containing a space.
4. **Hardcoded `main` base ref, unreachable `"untracked"` status, mis-parsed rename lines,
   raw git errors** (`src/git.ts`).
5. **`--format json` silently ignored**, accepted by both adapters, never implemented.

## What did you choose to implement or fix?

All five defect areas, plus the structural change that makes the hybrid decision real:

- Core now returns a structured `ReviewResult`; rendering (`renderReport`, markdown or
  JSON) is a separate step both adapters share.
- `src/git.ts`: repo validation (`rev-parse --is-inside-work-tree`), base-ref resolution
  (`origin/HEAD` → `main` → `master`, explicit refs verified), rename/copy line parsing,
  untracked files via `ls-files --others --exclude-standard`, and translation of all git
  failures (including the no-merge-base case) into typed `InspectorError`s.
- `src/validation.ts`: failures resolve as `status: "failed"` with exit codes instead of
  rejecting; timeouts (120 s default) report `exit -1` with a "timed out" message; output
  capped at 20 KB with a truncation marker.
- `src/cli.ts`: strict flag parsing, `--output`, `--format json`, exit codes 0 (clean) /
  1 (usage or inspector error) / 2 (validations failed) for CI use.
- `src/mcp-server.ts`: fixed the field-name bug; snake_case contract with real
  descriptions; a four-command validation allowlist; structured `isError` responses;
  ~50 KB report cap.
- Tests: 1 → 25 across five files (git fixture repos built per-test, validation
  pass/fail/timeout, arg parsing, the `runCli` execution path with exit codes 0/1/2,
  report formats and truncation, allowlist).
- A late architecture cleanup: the report and validation modules each had a copy-pasted
  byte-capped truncation loop; extracted a shared `truncateWithMarker` helper
  (`src/text.ts`) both delegate to.

## What did you intentionally not do?

- No automated MCP integration test; the handler wiring was verified with a manual stdio
  client instead. This is the first thing I'd add next.
- No configurable allowlist, no diff *content* in reports, no `-z` parsing for paths
  containing tabs, no CI workflow changes. All are listed under next steps rather than
  half-done.

## Interface decision

- **Decision: hybrid.**
- **Primary user and execution environment:** two users of equal standing, a developer at
  a terminal (locally or in CI) and an AI coding agent over MCP stdio. Both run on the
  developer's own machine against local repositories.
- **Trust boundary and allowed capabilities:** the boundary is *who supplies the shell
  command*, not the interface itself. The CLI accepts free-form `--validate` because the
  human typing it already has a shell, sanitizing there adds nothing. The MCP server may
  be driven by an agent influenced by untrusted repo content, so it only accepts an exact
  allowlist (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`); anything
  else returns a structured error naming the allowed set. Reading any local path is allowed
  on both interfaces, the tool runs with the user's own privileges and adds no network or
  write capabilities beyond the report file.
- **Reliability, discoverability, latency/context, and output tradeoffs:** both adapters
  are thin wrappers over one core, so there is a single behavior to keep correct.
  Discoverability: CLI usage line + README for humans; zod `.describe()` strings (including
  the embedded allowlist, so agents can self-correct) for MCP. Latency is git-bound and
  identical. Output: the CLI writes files of unbounded size for humans; the MCP response is
  capped (~50 KB report, 20 KB per validation) because agent context is the scarce
  resource.
- **How supported interfaces remain consistent:** both call `reviewRepository()` →
  `renderReport()`; neither adapter contains review logic. Expected failures are typed
  `InspectorError`s that the CLI prints as one-line messages (exit 1) and MCP returns as
  `isError: true` text, same taxonomy, interface-appropriate encoding. The two deliberate
  divergences (no `--output` over MCP, allowlist only over MCP) are boundary policy, not
  behavior drift.
- **Evidence that would change this decision:** telemetry showing one interface dominates
  (e.g. almost all invocations via agents → MCP-first, invest in richer structured
  output); a deployment where the MCP server runs with privileges the requesting agent
  shouldn't have (→ tighten to read-only, drop validation entirely); or users needing
  arbitrary validation commands via agents (→ move the allowlist to explicit user
  configuration rather than loosening the default).

## How did you use an AI coding agent?

I used AI agents (Cursor and Claude Code) throughout, but always with me making the
decisions. They helped with the initial defect survey, drafting the plan, implementing the
main hardening pass, and most heavily with adversarial verification: building scratch
repositories with every change type (including a path with a space), driving the MCP
server with a real stdio client, and probing edge cases like empty repos, a missing git
binary, and unrelated histories. I reviewed every diff and re-ranked the plan's priorities
myself.

I also used AI to help write this submission document. The ideas, decisions, and
prioritization in it are all mine; I used AI to help frame the writing and articulate my
words properly.

## Where did you check, correct, or reject an AI suggestion? (required)

- **Corrected:** the AI's defect report claimed the MCP field-name bug made calls "always
  fail" with a bogus cwd. I verified against the actual starter: `cwd: undefined` falls
  back to the server's own working directory, so calls *succeed* and return an
  empty-but-plausible report for the wrong repo. The severity assessment stood, but the
  failure mode was materially wrong (silent bad data, not a crash), and that distinction
  is what makes the bug dangerous to agents.
- **Rejected:** for timeout reporting, the AI's "pure" suggestion was widening
  `ValidationResult.exitCode` to `number | null`. I rejected it, the type change ripples
  through the report renderer and every consumer for marginal benefit. Instead I used an
  explicit `-1` sentinel plus a "timed out after Nms" message instead, with a test.

## Commands used to verify the result, with outcomes

- `npm run typecheck`: clean at every commit.
- `npm test`: 25/25 across 5 files (from 1/1 in the starter).
- CLI e2e against a scratch repo **whose path contains a space**, with
  added/modified/deleted/renamed/untracked files and `--validate "node -e process.exit(1)"`.
  All five statuses reported, validation shown as `[failed, exit 1]`, CLI exit 2.
- `--format json --output out.json`, valid JSON, round-trips `baseRef`/`changedFiles`/`ok`.
- Error paths: non-repo path, bogus `--base-ref`, `--format xml`, missing git on PATH -
  each a one-line error, exit 1, no stack traces.
- MCP over real stdio (SDK client): valid call returns the full report (proving the
  `repo_path` fix); `validation_commands: ["rm -rf /"]` → `isError: true` with the
  allowlist; non-repo path → `isError: true` without crashing the server.
- Edge cases: zero-commit repo (clean base-ref error), no-change repo (`(none)` sections,
  exit 0), unrelated-history base ref (clean no-merge-base error).

## A blocker you hit and how you approached it

The prescribed final check, `npm run inspector -- review --repo ./`, failed in my
verification checkout with a raw `fatal: origin/HEAD...HEAD: no merge base` escaping as an
unformatted fatal error. The checkout's `origin` pointed at a repository with unrelated
history, so `git diff base...HEAD` had no merge base. That setup was unusual, but the
same thing happens in real production scenarios (CI shallow clones with `--depth 1`,
forks with rewritten history).
My first instinct was to write it off as an environment quirk, but I decided to treat it
as the last uncovered git failure mode: `runGitDiff` now distinguishes "no merge base"
(actionable message suggesting an
explicit `--base-ref` or `git fetch --unshallow`) from other git failures (first `fatal:`
line surfaced in a typed error), with an orphan-branch test covering it.

## Known limitations and the next three things you would do

Limitations: no automated MCP integration test; missing git binary reports "Not a git
repository" (graceful but imprecise); paths containing tabs would mis-parse (`-z` parsing
not implemented); the allowlist is compiled in rather than user-configurable.

Next three:
1. An automated MCP integration test (spawn the server, drive it with the SDK client) -
   the highest-value gap, since the MCP contract is exactly what broke in the starter.
2. User-configurable MCP allowlist (e.g. `.inspectorrc`), keeping the current four commands
   as the default, the most-requested capability the trust model currently blocks.
3. `git diff --name-status -z` parsing so paths containing tabs or unusual characters are
   handled exactly.

## Approximate focused-work time

- Start: 2026-07-24, 10:27 PM
- Finish: 2026-07-24, 11:46 PM (~1 hour 19 minutes focused)
