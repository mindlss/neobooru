import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tmpFilePath(prefix: string, ext = 'bin') {
    const safeExt = ext.replace(/^\./, '').replace(/[^a-z0-9]/gi, '') || 'bin';
    const name = `${prefix}_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}.${safeExt}`;
    return path.join(os.tmpdir(), name);
}

export async function writeBufferToTemp(
    buffer: Buffer,
    prefix: string,
    ext = 'bin',
) {
    const tmpPath = tmpFilePath(prefix, ext);
    await fs.writeFile(tmpPath, buffer);
    return tmpPath;
}

export async function unlinkQuiet(filePath: string | null | undefined) {
    if (!filePath) return;
    await fs.unlink(filePath).catch(() => {});
}

export async function sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

export function sha256Buffer(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}
