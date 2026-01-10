import { asyncHandler } from '../utils/asyncHandler';
import { apiError } from '../errors/ApiError';
import { UserRole } from '@prisma/client';

import {
    createComic,
    updateComic,
    getComic,
    addComicPage,
    removeComicPage,
    reorderComicPages,
} from '../../domain/comics/comics.service';

function getViewer(req: any) {
    const u = req.currentUser ?? req.user;
    if (!u?.id || !u?.role) return null;
    return { id: u.id as string, role: u.role as UserRole };
}

export const createComicHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await createComic({ title: req.body.title, viewer });
        return res.status(201).json({ data });
    } catch (e: any) {
        if (e?.message === 'TITLE_INVALID')
            throw apiError(400, 'TITLE_INVALID', 'Invalid title');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});

export const updateComicHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await updateComic({
            comicId: req.params.id,
            viewer,
            ...req.body,
        });
        return res.json({ data });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND')
            throw apiError(404, 'NOT_FOUND', 'Comic not found');
        if (e?.message === 'FORBIDDEN')
            throw apiError(403, 'FORBIDDEN', 'Forbidden');
        if (e?.message === 'MEDIA_NOT_FOUND')
            throw apiError(404, 'MEDIA_NOT_FOUND', 'Media not found');
        if (e?.message === 'FORBIDDEN_MEDIA')
            throw apiError(403, 'FORBIDDEN', 'Cannot use this media');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});

export const getComicHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await getComic({ comicId: req.params.id, viewer });
        return res.json({ data });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND')
            throw apiError(404, 'NOT_FOUND', 'Comic not found');
        if (e?.message === 'FORBIDDEN')
            throw apiError(403, 'FORBIDDEN', 'Forbidden');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});

export const addComicPageHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await addComicPage({
            comicId: req.params.id,
            mediaId: req.body.mediaId,
            position: req.body.position,
            viewer,
        });
        return res.status(201).json({ data });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND')
            throw apiError(404, 'NOT_FOUND', 'Comic not found');
        if (e?.message === 'FORBIDDEN')
            throw apiError(403, 'FORBIDDEN', 'Forbidden');
        if (e?.message === 'MEDIA_NOT_FOUND')
            throw apiError(404, 'MEDIA_NOT_FOUND', 'Media not found');
        if (e?.message === 'FORBIDDEN_MEDIA')
            throw apiError(403, 'FORBIDDEN', 'Cannot use this media');
        if (e?.message === 'ALREADY_IN_COMIC')
            throw apiError(409, 'ALREADY_IN_COMIC', 'Media already in comic');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});

export const removeComicPageHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await removeComicPage({
            comicId: req.params.id,
            mediaId: req.params.mediaId,
            viewer,
        });
        return res.json({ data });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND')
            throw apiError(404, 'NOT_FOUND', 'Comic not found');
        if (e?.message === 'FORBIDDEN')
            throw apiError(403, 'FORBIDDEN', 'Forbidden');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});

export const reorderComicPagesHandler = asyncHandler(async (req, res) => {
    const viewer = getViewer(req);
    if (!viewer) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

    try {
        const data = await reorderComicPages({
            comicId: req.params.id,
            orderedMediaIds: req.body.orderedMediaIds,
            viewer,
        });
        return res.json({ data });
    } catch (e: any) {
        if (e?.message === 'NOT_FOUND')
            throw apiError(404, 'NOT_FOUND', 'Comic not found');
        if (e?.message === 'FORBIDDEN')
            throw apiError(403, 'FORBIDDEN', 'Forbidden');
        if (e?.message === 'BAD_ORDER_LENGTH')
            throw apiError(400, 'BAD_ORDER_LENGTH', 'Bad order length');
        if (e?.message === 'BAD_ORDER_MEDIA')
            throw apiError(400, 'BAD_ORDER_MEDIA', 'Bad order media');
        if (e?.message === 'BAD_ORDER_DUP')
            throw apiError(400, 'BAD_ORDER_DUP', 'Duplicate media in order');
        throw apiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
    }
});
