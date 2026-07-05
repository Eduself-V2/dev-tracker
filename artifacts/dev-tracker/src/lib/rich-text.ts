// Content written before rich text support was added is stored as plain text.
// This detects that case so callers can upgrade it to safe HTML (preserving line breaks/links)
// before handing it to a Tiptap editor or an HTML renderer.
export function looksLikeHtml(raw: string): boolean {
  return /<[a-z][\s\S]*>/i.test(raw);
}

export function plainTextToHtml(raw: string): string {
  if (looksLikeHtml(raw)) return raw;

  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline break-all">${url}</a>`,
  );
  return linked.replace(/\n/g, "<br>");
}
