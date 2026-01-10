import pino, { type Logger, type LoggerOptions } from 'pino';
import { env } from './env';
import { mkdirSync } from 'node:fs';

const rfs =
    require('rotating-file-stream') as typeof import('rotating-file-stream');

let pinoPretty: any;
try {
    pinoPretty = require('pino-pretty');
} catch {
    pinoPretty = null;
}

type RfsInterval =
    | `${number}d`
    | `${number}s`
    | `${number}M`
    | `${number}h`
    | `${number}m`;
type RfsSize = `${number}M` | `${number}B` | `${number}K` | `${number}G`;

function ensureLogDir(dir: string) {
    try {
        mkdirSync(dir, { recursive: true });
    } catch {}
}

function fileStream(basename: string) {
    ensureLogDir(env.LOG_DIR);

    const interval = env.LOG_ROTATE_INTERVAL as RfsInterval;
    const size = env.LOG_ROTATE_SIZE as RfsSize;

    return rfs.createStream(basename, {
        path: env.LOG_DIR,
        interval,
        size,
        maxFiles: env.LOG_MAX_FILES,
        compress: 'gzip',
    });
}

function toStreamLevel(level: typeof env.LOG_LEVEL): pino.Level | undefined {
    if (level === 'silent') return undefined;
    return level;
}

function buildConsoleStream() {
    const isDev = env.NODE_ENV === 'development';
    if (isDev && pinoPretty) {
        return pinoPretty({
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: true,
        });
    }
    return process.stdout;
}

const baseOptions: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["set-cookie"]',
            'headers.authorization',
            'headers.cookie',
            'headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
        remove: false,
    },
};

function buildAppLoggerStreams() {
    const streams: pino.StreamEntry[] = [];
    const level = toStreamLevel(env.LOG_LEVEL);
    if (!level) return streams;

    // console
    streams.push({ level, stream: buildConsoleStream() });

    if (env.LOG_TO_FILE === 'true' && env.NODE_ENV !== 'test') {
        // app.log: all app logs
        streams.push({ level, stream: fileStream(env.LOG_APP_FILE_BASENAME) });

        // error.log: warn+
        streams.push({
            level: 'warn',
            stream: fileStream(env.LOG_ERROR_FILE_BASENAME),
        });
    }

    return streams;
}

function buildHttpLoggerStreams() {
    const streams: pino.StreamEntry[] = [];
    const level = toStreamLevel(env.LOG_LEVEL);
    if (!level) return streams;

    // console
    streams.push({ level, stream: buildConsoleStream() });

    if (env.LOG_TO_FILE === 'true' && env.NODE_ENV !== 'test') {
        // access.log: all requests
        streams.push({
            level,
            stream: fileStream(env.LOG_ACCESS_FILE_BASENAME),
        });

        // error.log: warn+ requests (4xx/5xx)
        streams.push({
            level: 'warn',
            stream: fileStream(env.LOG_ERROR_FILE_BASENAME),
        });
    }

    return streams;
}

const appStreams = buildAppLoggerStreams();
export const logger: Logger =
    appStreams.length > 0
        ? pino(baseOptions, pino.multistream(appStreams))
        : pino(baseOptions);

const httpStreams = buildHttpLoggerStreams();
export const httpLogger: Logger =
    httpStreams.length > 0
        ? pino(baseOptions, pino.multistream(httpStreams))
        : pino(baseOptions);
