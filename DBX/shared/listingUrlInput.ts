/** Shared URL validation for listing-improve, analysis, and compliance fetch. */
export function isValidHttpListingUrl(raw: string): boolean {
  const u = raw.trim();
  if (u.length < 12 || u.length > 2048) return false;
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}
