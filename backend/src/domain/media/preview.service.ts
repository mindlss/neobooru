import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { MediaType } from '@prisma/client';

import { tmpFilePath, unlinkQuiet } from '../../utils/files';
import type { ExtractedMetadata } from './metadata.service';

const execFileAsync = promisify(execFile);

const PREVIEW_SIZE = 512;

export type GeneratedPreview = {
    tmpPath: string;
    ext: 'webp';
    contentType: 'image/webp';
};

async function generateImagePreview(inputPath: string, meta: ExtractedMetadata) {
    const outputPath = tmpFilePath('preview', 'webp');

    try {
        await sharp(inputPath, { animated: meta.isAnimated })
            .resize({
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({
                quality: meta.isAnimated ? 60 : 72,
                effort: 4,
            })
            .toFile(outputPath);
    } catch (e) {
        await unlinkQuiet(outputPath);
        throw e;
    }

    return outputPath;
}

async function generateVideoPreview(inputPath: string) {
    if (!ffmpegPath) {
        throw new Error('FFMPEG_NOT_AVAILABLE');
    }

    const outputPath = tmpFilePath('preview', 'webp');

    try {
        await execFileAsync(ffmpegPath, [
            '-y',
            '-i',
            inputPath,
            '-t',
            '6',
            '-vf',
            `fps=4,scale=w='min(${PREVIEW_SIZE},iw)':h=-2:flags=lanczos`,
            '-an',
            '-loop',
            '0',
            '-c:v',
            'libwebp',
            '-quality',
            '60',
            '-compression_level',
            '6',
            outputPath,
        ]);
    } catch (e) {
        await unlinkQuiet(outputPath);
        throw e;
    }

    return outputPath;
}

export async function generateMediaPreview(params: {
    tmpPath: string;
    meta: ExtractedMetadata;
}): Promise<GeneratedPreview> {
    const tmpPath =
        params.meta.mediaType === MediaType.VIDEO
            ? await generateVideoPreview(params.tmpPath)
            : await generateImagePreview(params.tmpPath, params.meta);

    return {
        tmpPath,
        ext: 'webp',
        contentType: 'image/webp',
    };
}
