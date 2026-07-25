export const ALLOWED_MCP_VALIDATION_COMMANDS = [
  "npm test",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
] as const;

export type AllowedMcpValidationCommand = (typeof ALLOWED_MCP_VALIDATION_COMMANDS)[number];

export function filterAllowedMcpCommands(commands: string[] | undefined): {
  allowed: string[];
  disallowed: string[];
} {
  const requested = commands ?? [];
  const allowedSet = new Set<string>(ALLOWED_MCP_VALIDATION_COMMANDS);
  const allowed: string[] = [];
  const disallowed: string[] = [];

  for (const command of requested) {
    if (allowedSet.has(command)) {
      allowed.push(command);
    } else {
      disallowed.push(command);
    }
  }

  return { allowed, disallowed };
}

export function formatAllowlistError(disallowed: string[]): string {
  const listed = ALLOWED_MCP_VALIDATION_COMMANDS.map((command) => `"${command}"`).join(", ");
  const rejected = disallowed.map((command) => `"${command}"`).join(", ");
  return `Disallowed validation command(s): ${rejected}. Allowed commands: ${listed}.`;
}
