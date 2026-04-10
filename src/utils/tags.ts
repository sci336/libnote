export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return tag.length > 0;
}
