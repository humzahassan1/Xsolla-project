export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
};

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  output: string;
  exitCode: number;
};

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: string[];
  format?: "markdown" | "json";
};

export type ReviewResult = {
  repositoryPath: string;
  baseRef: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
  ok: boolean;
};

export type ReportFormat = "markdown" | "json";
