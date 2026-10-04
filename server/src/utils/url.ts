// If a friend URL is a redirect link (e.g. https://link.example.com/?...&to=https://real.com&...),
// extract the real target from the `to` param. Otherwise return the URL unchanged.
export function extractTargetUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const to = parsed.searchParams.get("to");
        if (to && to.length > 0) return to;
        return url;
    } catch {
        return url;
    }
}
