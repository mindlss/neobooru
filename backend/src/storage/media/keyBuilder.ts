export function buildOriginalKey(hash: string, ext?: string) {
    const safeExt = ext ? ext.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
    return safeExt ? `original/${hash}.${safeExt}` : `original/${hash}`;
}

export function buildPreviewKey(hash: string, ext = 'webp') {
    return `preview/${hash}.${ext}`;
}
