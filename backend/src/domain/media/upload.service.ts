/* eslint-disable no-useless-assignment */
import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';

import Busboy from 'busboy';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { buildOriginalKey, buildPreviewKey } from '../../storage/media/keyBuilder';
import {
  sha256File,
  sha256Buffer,
  tmpFilePath,
  unlinkQuiet,
  writeBufferToTemp,
} from '../../utils/files';
import { removeObjectsQuiet } from '../../utils/storage';

import {
  extractMetadataFromTempFile,
  UnsupportedMediaTypeError,
} from './metadata.service';
import { generateMediaPreview } from './preview.service';

import { parseTags } from '../tags/tags.parser';
import { deriveAutoTags } from '../tags/tags.auto';
import { setTagsForMedia } from '../tags/tags.service';
import { SYSTEM_PRINCIPAL } from '../auth/systemPrincipal';

type ParsedUpload = {
  tmpPath: string;
  sha256: string;
  size: number;
  mimeType: string;
  filename?: string;
  description?: string;
  tagsRaw?: string;
};

// -------------------- helpers --------------------

function normalizeMergedTags(tags: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const t of tags) {
    const name = String(t || '').trim().toLowerCase();
    if (!name) continue;
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }
  return merged;
}

// -------------------- tsoa multer path --------------------

/**
 * Use with tsoa built-in multer:
 * - memoryStorage => file.buffer exists, file.path is empty
 * - diskStorage   => file.path exists
 */
export async function uploadMediaFromMulterFile(input: {
  file: Express.Multer.File;
  uploadedById: string;
  description?: string;
  tagsRaw?: string;
}) {
  const f = input.file;

  if (!f) throw new Error('NO_FILE');

  if (f.path) {
    const sha256 = await sha256File(f.path);

    try {
      return await uploadMediaFromTemp({
        tmpPath: f.path,
        sha256,
        size: typeof f.size === 'number' ? f.size : (await fs.stat(f.path)).size,
        mimeType: f.mimetype || 'application/octet-stream',
        uploadedById: input.uploadedById,
        description: input.description,
        tagsRaw: input.tagsRaw,
      });
    } finally {
      await unlinkQuiet(f.path);
    }
  }

  // memory storage (tsoa default)
  if (!f.buffer || f.buffer.length === 0) {
    throw new Error('NO_FILE');
  }

  const sha256 = sha256Buffer(f.buffer);
  const tmpPath = await writeBufferToTemp(f.buffer, 'upload', 'bin');

  try {
    return await uploadMediaFromTemp({
      tmpPath,
      sha256,
      size: typeof f.size === 'number' ? f.size : f.buffer.length,
      mimeType: f.mimetype || 'application/octet-stream',
      uploadedById: input.uploadedById,
      description: input.description,
      tagsRaw: input.tagsRaw,
    });
  } finally {
    await unlinkQuiet(tmpPath);
  }
}

// -------------------- legacy busboy path --------------------

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

    let description: string | undefined;
    let tagsRaw: string | undefined;

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
        } catch {
          // Best-effort cleanup.
        }
      }

      if (p) fs.unlink(p).catch(() => {});
      reject(err);
    }

    bb.on('field', (fieldname: string, val: any) => {
      const value = typeof val === 'string' ? val : String(val ?? '');
      if (fieldname === 'description') {
        const v = value.trim();
        if (v.length > 0) description = v.slice(0, 5000);
      }
      if (fieldname === 'tags') {
        const v = value.trim();
        if (v.length > 0) tagsRaw = v.slice(0, 5000);
      }
    });

    bb.on('file', (_fieldname, file, info) => {
      filename = info.filename || undefined;
      mimeType = info.mimeType || 'application/octet-stream';

      tmpPath = tmpFilePath('upload', 'bin');
      fileWrite = createWriteStream(tmpPath);

      file.on('data', (chunk: Buffer) => {
        size += chunk.length;
        hash.update(chunk);
      });

      file.on('limit', () => cleanupAndReject(new Error('FILE_TOO_LARGE')));

      file.on('error', (e: any) =>
        cleanupAndReject(e instanceof Error ? e : new Error('UPLOAD_STREAM_ERROR')),
      );

      fileWrite.on('error', (e) => cleanupAndReject(e));

      file.pipe(fileWrite);
    });

    bb.on('error', (e) =>
      cleanupAndReject(e instanceof Error ? e : new Error('MULTIPART_ERROR')),
    );

    bb.on('finish', () => {
      if (done) return;
      done = true;

      if (!tmpPath) return reject(new Error('NO_FILE'));

      resolve({
        tmpPath,
        sha256: hash.digest('hex'),
        size,
        mimeType,
        filename,
        description,
        tagsRaw,
      });
    });

    req.pipe(bb);
  });
}

// -------------------- core upload from temp --------------------

export async function uploadMediaFromTemp(input: {
  tmpPath: string;
  sha256: string;
  size: number;
  mimeType: string;
  uploadedById: string;
  description?: string;
  tagsRaw?: string;
}) {
  let originalKey: string | null = null;
  let previewKey: string | null = null;
  let previewTmpPath: string | null = null;

  // 1) Blocked hash?
  const blocked = await prisma.blockedHash.findUnique({
    where: { hash: input.sha256 },
    select: { id: true },
  });
  if (blocked) throw new Error('BLOCKED_HASH');

  // 2) Dedup by hash
  const existing = await prisma.media.findUnique({
    where: { hash: input.sha256 },
    select: { id: true },
  });
  if (existing) throw new Error('DUPLICATE_HASH');

  // 3) Extract real metadata (sniff file)
  let meta: {
    mediaType: any;
    contentType: string;
    ext: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    isAnimated: boolean;
  };

  try {
    meta = await extractMetadataFromTempFile(input.tmpPath);
  } catch (e: any) {
    if (e instanceof UnsupportedMediaTypeError || e?.message === 'UNSUPPORTED_MEDIA_TYPE') {
      throw new Error('UNSUPPORTED_MEDIA_TYPE');
    }
    throw e;
  }

  // 4) Build storage key from REAL ext
  originalKey = buildOriginalKey(input.sha256, meta.ext || undefined);
  const preview = await generateMediaPreview({
    tmpPath: input.tmpPath,
    meta,
  });
  previewTmpPath = preview.tmpPath;
  previewKey = buildPreviewKey(input.sha256, preview.ext);

  try {
    // 5) Upload to MinIO (real content-types)
    await minio.fPutObject(env.MINIO_BUCKET, originalKey, input.tmpPath, {
      'Content-Type': meta.contentType,
    });
    await minio.fPutObject(env.MINIO_BUCKET, previewKey, preview.tmpPath, {
      'Content-Type': preview.contentType,
    });

    // 6) Create DB record
    const desc =
      typeof input.description === 'string' && input.description.trim().length > 0
        ? input.description.trim().slice(0, 5000)
        : null;

    const userTags = parseTags(input.tagsRaw);
    const autoTags = deriveAutoTags(meta);

    const merged = normalizeMergedTags([...userTags, ...autoTags]);

    const media = await prisma.$transaction(async (tx) => {
      const created = await tx.media.create({
        data: {
          originalKey,
          previewKey,
          hash: input.sha256,
          contentType: meta.contentType,
          size: input.size,

          width: meta.width,
          height: meta.height,
          duration: meta.duration,

          description: desc,
          type: meta.mediaType,

          uploadedById: input.uploadedById,
          // moderationStatus default = PENDING
        },
      });

      await tx.user.update({
        where: { id: input.uploadedById },
        data: { uploadCount: { increment: 1 } },
        select: { id: true },
      });

      return created;
    });

    // 7) Apply tags (system principal)
    if (merged.length > 0) {
      try {
        await setTagsForMedia({
          mediaId: media.id,
          tagNames: merged,
          principal: SYSTEM_PRINCIPAL,
        });
      } catch (e) {
        await prisma.$transaction([
          prisma.media.delete({ where: { id: media.id } }),
          prisma.user.update({
            where: { id: input.uploadedById },
            data: { uploadCount: { decrement: 1 } },
          }),
        ]).catch(() => {});
        throw e;
      }
    }

    return media;
  } catch (e) {
    await removeObjectsQuiet([originalKey, previewKey]);
    throw e;
  } finally {
    // 8) Cleanup temp files
    await unlinkQuiet(previewTmpPath);
    await unlinkQuiet(input.tmpPath);
  }
}
