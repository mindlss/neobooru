export function parseTags(input?: string): string[] {
    if (!input) return [];

    const normalized = input.replace(/,/g, ' ');
    const parts = normalized
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        const t = p.toLowerCase();
        if (!seen.has(t)) {
            seen.add(t);
            out.push(t);
        }
    }
    return out;
}
