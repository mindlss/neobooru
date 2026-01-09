import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PassThrough } from 'node:stream';

import Busboy from 'busboy';
import mime from 'mime-types';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { buildOriginalKey } from '../../storage/media/keyBuilder';
import { MediaType } from '@prisma/client';

type ParsedUpload = {
    tmpPath: string;
    sha256: string;
    size: number;
    mimeType: string;
    filename?: string;
};

export async function parseMultipartToTemp(req: any): Promise<ParsedUpload> {
    return new Promise((resolve, reject) => {
        const bb = Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: env.MAX_UPLOAD_BYTES,
            },
        });

        let done = false;

        let tmpPath: string | null = null;
        let filename: string | undefined;
        let mimeType = 'application/octet-stream';
        let size = 0;

        const hash = createHash('sha256');
        let fileWrite: ReturnType<typeof createWriteStream> | null = null;

        function cleanupAndReject(err: Error) {
            if (done) return;
            done = true;

            const p = tmpPath;
            tmpPath = null;

            if (fileWrite) {
                try {
                    fileWrite.close();
                } catch {}
            }

            if (p) {
                fs.unlink(p).catch(() => {});
            }

            reject(err);
        }

        bb.on('file', (_fieldname, file, info) => {
            filename = info.filename || undefined;
            mimeType = info.mimeType || 'application/octet-stream';

            const tmpName = `upload_${Date.now()}_${Math.random()
                .toString(16)
                .slice(2)}.bin`;
            tmpPath = path.join(os.tmpdir(), tmpName);

            fileWrite = createWriteStream(tmpPath);

            file.on('data', (chunk: Buffer) => {
                size += chunk.length;
                hash.update(chunk);
            });

            file.on('limit', () => {
                cleanupAndReject(new Error('FILE_TOO_LARGE'));
            });

            file.on('error', (e: any) =>
                cleanupAndReject(
                    e instanceof Error ? e : new Error('UPLOAD_STREAM_ERROR')
                )
            );

            fileWrite.on('error', (e) => cleanupAndReject(e));

            file.pipe(fileWrite);
        });

        bb.on('error', (e) =>
            cleanupAndReject(
                e instanceof Error ? e : new Error('MULTIPART_ERROR')
            )
        );

        bb.on('finish', () => {
            if (done) return;
            done = true;

            if (!tmpPath) {
                return reject(new Error('NO_FILE'));
            }

            const sha256 = hash.digest('hex');

            resolve({
                tmpPath,
                sha256,
                size,
                mimeType,
                filename,
            });
        });

        req.pipe(bb);
    });
}

function mediaTypeFromMime(mimeType: string): MediaType | null {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    return null;
}

export async function uploadMediaFromTemp(input: {
    tmpPath: string;
    sha256: string;
    size: number;
    mimeType: string;
    uploadedById: string;
}) {
    // 1) Blocked hash?
    const blocked = await prisma.blockedHash.findUnique({
        where: { hash: input.sha256 },
    });

    if (blocked) {
        throw new Error('BLOCKED_HASH');
    }

    // 2) Dedup by hash
    const existing = await prisma.media.findUnique({
        where: { hash: input.sha256 },
    });

    if (existing) {
        throw new Error('DUPLICATE_HASH');
    }

    // 3) Validate type
    const mType = mediaTypeFromMime(input.mimeType);
    if (!mType) {
        throw new Error('UNSUPPORTED_MEDIA_TYPE');
    }

    // 4) Build key
    const ext = mime.extension(input.mimeType) || undefined;
    const originalKey = buildOriginalKey(input.sha256, ext);

    // 5) Upload to MinIO
    await minio.fPutObject(env.MINIO_BUCKET, originalKey, input.tmpPath, {
        'Content-Type': input.mimeType,
    });

    // 6) Create DB record
    const media = await prisma.media.create({
        data: {
            originalKey,
            hash: input.sha256,
            contentType: input.mimeType,
            size: input.size,
            type: mType,
            uploadedById: input.uploadedById,
            // moderationStatus default = PENDING (из schema)
        },
    });

    // 7) Cleanup temp file
    await fs.unlink(input.tmpPath).catch(() => {});

    return media;
}
