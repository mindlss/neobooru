import type { ExtractedMetadata } from '../media/metadata.service';
import { MediaType } from '@prisma/client';

export type AutoTagOptions = {
    highresMinPixels?: number; // default 4MP
    longVideoSeconds?: number; // default 60
};

export function deriveAutoTags(
    meta: ExtractedMetadata,
    opts: AutoTagOptions = {}
): string[] {
    const highresMinPixels = opts.highresMinPixels ?? 4_000_000; // 4MP
    const longVideoSeconds = opts.longVideoSeconds ?? 60;

    const tags: string[] = [];

    // format
    if (meta.ext === 'gif') tags.push('gif');

    if (meta.mediaType === MediaType.VIDEO) {
        tags.push('video');
        if (
            typeof meta.duration === 'number' &&
            meta.duration >= longVideoSeconds
        ) {
            tags.push('long');
        }
    }

    if (meta.mediaType === MediaType.IMAGE) {
        if (meta.isAnimated) tags.push('animated');
    }

    // resolution-based
    if (typeof meta.width === 'number' && typeof meta.height === 'number') {
        const pixels = meta.width * meta.height;
        if (pixels >= highresMinPixels) tags.push('highres');

        if (meta.width >= 3840 || meta.height >= 2160) tags.push('4k');
    }

    return tags;
}
