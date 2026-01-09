import fs from 'node:fs/promises';
import sharp from 'sharp';
import { fileTypeFromFile } from 'file-type';
import ffprobeStatic from 'ffprobe-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MediaType } from '@prisma/client';

const execFileAsync = promisify(execFile);

export type ExtractedMetadata = {
    mediaType: MediaType;
    contentType: string;
    ext: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    isAnimated: boolean;
};

export class UnsupportedMediaTypeError extends Error {
    constructor() {
        super('UNSUPPORTED_MEDIA_TYPE');
    }
}

async function probeVideo(path: string): Promise<{
    width: number | null;
    height: number | null;
    duration: number | null;
}> {
    const ffprobePath = ffprobeStatic.path;
    if (!ffprobePath) {
        return { width: null, height: null, duration: null };
    }

    const { stdout } = await execFileAsync(ffprobePath, [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_streams',
        '-show_format',
        path,
    ]);

    const json = JSON.parse(stdout);

    const streams: any[] = Array.isArray(json.streams) ? json.streams : [];
    const v = streams.find((s) => s.codec_type === 'video') ?? null;

    const width = v?.width ? Number(v.width) : null;
    const height = v?.height ? Number(v.height) : null;

    const d = json?.format?.duration ? Number(json.format.duration) : 0;
    const duration = Number.isFinite(d) ? Math.round(d) : null;

    return { width, height, duration };
}

export async function extractMetadataFromTempFile(
    tmpPath: string
): Promise<ExtractedMetadata> {
    const ft = await fileTypeFromFile(tmpPath);

    if (!ft) {
        throw new UnsupportedMediaTypeError();
    }

    const { mime, ext } = ft;

    if (
        mime === 'image/png' ||
        mime === 'image/jpeg' ||
        mime === 'image/webp' ||
        mime === 'image/gif'
    ) {
        const img = sharp(tmpPath, { animated: true });
        const meta = await img.metadata();
        const pages = typeof meta.pages === 'number' ? meta.pages : 1;

        return {
            mediaType: MediaType.IMAGE,
            contentType: mime,
            ext,
            width: meta.width ?? null,
            height: meta.height ?? null,
            duration: null,
            isAnimated: mime === 'image/gif' && pages > 1,
        };
    }

    if (
        mime === 'video/mp4' ||
        mime === 'video/webm' ||
        mime === 'video/quicktime'
    ) {
        const v = await probeVideo(tmpPath);

        return {
            mediaType: MediaType.VIDEO,
            contentType: mime,
            ext,
            width: v.width,
            height: v.height,
            duration: v.duration,
            isAnimated: true,
        };
    }

    throw new UnsupportedMediaTypeError();
}

export async function assertFileExists(path: string) {
    await fs.stat(path);
}
