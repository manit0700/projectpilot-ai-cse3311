// Public origin used for absolute metadata URLs. Falls back to localhost so a
// missing or malformed NEXT_PUBLIC_SITE_URL can never break the build.
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return url;
    } catch {
      // fall through to the safe default
    }
  }
  return new URL("http://localhost:3000");
}
