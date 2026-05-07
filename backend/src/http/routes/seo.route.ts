import { Router } from 'express';
import { ModerationStatus } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const router = Router();

const STATIC_ROUTES = [
    { path: '/', priority: '1.0', changefreq: 'hourly' },
    { path: '/search-help', priority: '0.6', changefreq: 'monthly' },
];

const PROTECTED_ROUTES = ['/admin', '/me', '/upload'];
const AUTH_ROUTES = ['/login', '/register'];
const SITEMAP_LIMIT = 10_000;

function siteUrl() {
    return env.PUBLIC_APP_URL.replace(/\/+$/, '');
}

function absoluteUrl(path: string) {
    return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function xmlEscape(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sitemapEntry(params: {
    path: string;
    lastmod?: Date;
    changefreq?: string;
    priority?: string;
}) {
    return [
        '  <url>',
        `    <loc>${xmlEscape(absoluteUrl(params.path))}</loc>`,
        params.lastmod
            ? `    <lastmod>${params.lastmod.toISOString()}</lastmod>`
            : null,
        params.changefreq
            ? `    <changefreq>${params.changefreq}</changefreq>`
            : null,
        params.priority ? `    <priority>${params.priority}</priority>` : null,
        '  </url>',
    ]
        .filter(Boolean)
        .join('\n');
}

router.get('/robots.txt', (_req, res) => {
    const disallowRules = [...PROTECTED_ROUTES, ...AUTH_ROUTES]
        .map((path) => `Disallow: ${path}`)
        .join('\n');

    res.type('text/plain').send(
        [
            'User-agent: *',
            'Allow: /',
            disallowRules,
            `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
            '',
        ].join('\n'),
    );
});

router.get('/sitemap.xml', async (_req, res, next) => {
    try {
        const [media, users] = await Promise.all([
            prisma.media.findMany({
                where: {
                    deletedAt: null,
                    moderationStatus: ModerationStatus.APPROVED,
                    isExplicit: false,
                },
                orderBy: { updatedAt: 'desc' },
                take: SITEMAP_LIMIT,
                select: { id: true, updatedAt: true, createdAt: true },
            }),
            prisma.user.findMany({
                where: { deletedAt: null, showUploads: true },
                orderBy: { updatedAt: 'desc' },
                take: SITEMAP_LIMIT,
                select: { id: true, updatedAt: true, createdAt: true },
            }),
        ]);

        const entries = [
            ...STATIC_ROUTES.map((route) => sitemapEntry(route)),
            ...media.map((item) =>
                sitemapEntry({
                    path: `/media/${item.id}`,
                    lastmod: item.updatedAt ?? item.createdAt,
                    changefreq: 'weekly',
                    priority: '0.8',
                }),
            ),
            ...users.map((user) =>
                sitemapEntry({
                    path: `/users/${user.id}`,
                    lastmod: user.updatedAt ?? user.createdAt,
                    changefreq: 'weekly',
                    priority: '0.5',
                }),
            ),
        ];

        res.type('application/xml').send(
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                entries.join('\n'),
                '</urlset>',
                '',
            ].join('\n'),
        );
    } catch (err) {
        next(err);
    }
});

export const seoRouter = router;
