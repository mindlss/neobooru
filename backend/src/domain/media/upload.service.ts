import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Busboy from 'busboy';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { minio } from '../../lib/minio';
import { buildOriginalKey } from '../../storage/media/keyBuilder';

import {
  extractMetadataFromTempFile,
  UnsupportedMediaTypeError,
} from './metadata.service';

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

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const rs = createReadStream(filePath);
    rs.on('data', (chunk) => hash.update(chunk));
    rs.on('error', reject);
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

function tmpFilePath(ext?: string) {
  const suffix = ext ? `.${ext.replace(/^\./, '')}` : '.bin';
  const name = `upload_${Date.now()}_${Math.random().toString(16).slice(2)}${suffix}`;
  return path.join(os.tmpdir(), name);
}

async function writeBufferToTemp(buf: Buffer) {
  const p = tmpFilePath('bin');
  await fs.writeFile(p, buf);
  return p;
}

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

    return uploadMediaFromTemp({
      tmpPath: f.path,
      sha256,
      size: typeof f.size === 'number' ? f.size : (await fs.stat(f.path)).size,
      mimeType: f.mimetype || 'application/octet-stream',
      uploadedById: input.uploadedById,
      description: input.description,
      tagsRaw: input.tagsRaw,
    });
  }

  // memory storage (tsoa default)
  if (!f.buffer || f.buffer.length === 0) {
    throw new Error('NO_FILE');
  }

  const sha256 = createHash('sha256').update(f.buffer).digest('hex');
  const tmpPath = await writeBufferToTemp(f.buffer);

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
    await fs.unlink(tmpPath).catch(() => {});
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
        } catch {}
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

      tmpPath = tmpFilePath('bin');
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
  const originalKey = buildOriginalKey(input.sha256, meta.ext || undefined);

  // 5) Upload to MinIO (real content-type)
  await minio.fPutObject(env.MINIO_BUCKET, originalKey, input.tmpPath, {
    'Content-Type': meta.contentType,
  });

  // 6) Create DB record
  const desc =
    typeof input.description === 'string' && input.description.trim().length > 0
      ? input.description.trim().slice(0, 5000)
      : null;

  const userTags = parseTags(input.tagsRaw);
  const autoTags = deriveAutoTags(meta);

  const merged = normalizeMergedTags([...userTags, ...autoTags]);

  const media = await prisma.media.create({
    data: {
      originalKey,
      previewKey: null,
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

  // 7) Apply tags (system principal)
  if (merged.length > 0) {
    await setTagsForMedia({
      mediaId: media.id,
      tagNames: merged,
      principal: SYSTEM_PRINCIPAL,
    });
  }

  // 8) Cleanup temp file
  await fs.unlink(input.tmpPath).catch(() => {});

  return media;
}