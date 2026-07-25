export function truncateWithMarker(text: string, maxBytes: number, marker: string): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return text;
  }

  const budget = maxBytes - Buffer.byteLength(marker, "utf8");
  let truncated = "";
  for (const char of text) {
    const next = truncated + char;
    if (Buffer.byteLength(next, "utf8") > budget) {
      break;
    }
    truncated = next;
  }
  return truncated + marker;
}
