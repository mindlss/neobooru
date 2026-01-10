import Busboy from 'busboy';
import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fileTypeFromFile } from 'file-type';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { buildAvatarKey } from '../../storage/media/keyBuilder';

type ParsedAvatarUpload = {
    tmpPath: string;
    sha256: string;
    size: number;
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

export async function parseAvatarMultipartToTemp(
    req: any
): Promise<ParsedAvatarUpload> {
    return new Promise((resolve, reject) => {
        const bb = Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: env.AVATAR_MAX_BYTES,
            },
        });

        let done = false;

        let tmpPath: string | null = null;
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

            if (p) fs.unlink(p).catch(() => {});
            reject(err);
        }

        bb.on('file', (_fieldname, file) => {
            const tmpName = `avatar_${Date.now()}_${Math.random()
                .toString(16)
                .slice(2)}.bin`;
            tmpPath = path.join(os.tmpdir(), tmpName);

            fileWrite = createWriteStream(tmpPath);

            file.on('data', (chunk: Buffer) => {
                size += chunk.length;
                hash.update(chunk);
            });

            file.on('limit', () =>
                cleanupAndReject(new Error('FILE_TOO_LARGE'))
            );
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

            if (!tmpPath) return reject(new Error('NO_FILE'));

            const sha256 = hash.digest('hex');

            resolve({
                tmpPath,
                sha256,
                size,
            });
        });

        req.pipe(bb);
    });
}

export async function uploadUserAvatarFromTemp(params: {
    userId: string;
    tmpPath: string;
    sha256: string;
}) {
    const ft = await fileTypeFromFile(params.tmpPath);
    const mime = ft?.mime ?? '';
    const ext = (ft?.ext ?? '').toLowerCase();

    if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) {
        await fs.unlink(params.tmpPath).catch(() => {});
        throw new Error('UNSUPPORTED_AVATAR_TYPE');
    }

    const key = buildAvatarKey(params.userId, params.sha256, ext);

    const prev = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { avatarKey: true },
    });

    await minio.fPutObject(env.MINIO_BUCKET, key, params.tmpPath, {
        'Content-Type': mime,
    });

    await prisma.user.update({
        where: { id: params.userId },
        data: { avatarKey: key },
        select: { id: true },
    });

    await fs.unlink(params.tmpPath).catch(() => {});

    if (prev?.avatarKey && prev.avatarKey !== key) {
        minio.removeObject(env.MINIO_BUCKET, prev.avatarKey).catch(() => {});
    }

    return { avatarKey: key };
}
