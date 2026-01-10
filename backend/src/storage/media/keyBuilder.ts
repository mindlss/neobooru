export function buildOriginalKey(hash: string, ext?: string) {
    const safeExt = ext ? ext.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
    return safeExt ? `original/${hash}.${safeExt}` : `original/${hash}`;
}

export function buildPreviewKey(hash: string, ext = 'webp') {
    return `preview/${hash}.${ext}`;
}

export function buildAvatarKey(userId: string, sha256: string, ext: string) {
    const safeUserId = userId.replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    return `avatars/${safeUserId}/${sha256}.${safeExt}`;
}
