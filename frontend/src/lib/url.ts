/**
 * Neutralises user-controlled URLs before they are used as an <a href>.
 *
 * Blocks `javascript:`/`data:`/`vbscript:` schemes (which would execute script in our origin
 * when clicked — stored XSS) and assumes `https://` for bare hostnames like "example.com".
 * Returns "#" for empty or dangerous input.
 *
 * Every place that renders a link coming from user input (profile social links, organisation /
 * project website/twitter/youtube/extra_links, etc.) must pass it through this first.
 */
export function sanitizeUrl(urlStr: string | null | undefined): string {
    if (!urlStr) return '#';
    const trimmed = urlStr.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
        return '#';
    }
    if (!/^[a-z0-9+.-]+:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
}
