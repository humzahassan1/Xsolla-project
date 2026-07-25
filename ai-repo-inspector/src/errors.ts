export type InspectorErrorKind =
  | "not-a-repo"
  | "unknown-ref"
  | "disallowed-command"
  | "usage";

export class InspectorError extends Error {
  readonly kind: InspectorErrorKind;

  constructor(kind: InspectorErrorKind, message: string) {
    super(message);
    this.name = "InspectorError";
    this.kind = kind;
  }
}
