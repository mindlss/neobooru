import { asyncHandler } from '../utils/asyncHandler';
import {
    queueQuerySchema,
    moderationActionSchema,
} from '../schemas/moderation.schemas';
import {
    approveMedia,
    listPendingMedia,
    rejectMedia,
} from '../../domain/moderation/moderation.service';
import { toModerationQueueItemDTO } from '../dto';

export const getQueue = asyncHandler(async (req, res) => {
    const q = queueQuerySchema.parse(req.query);

    const result = await listPendingMedia({ limit: q.limit, cursor: q.cursor });

    res.json({
        data: result.data.map(toModerationQueueItemDTO),
        nextCursor: result.nextCursor ?? null,
    });
});

export const approve = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = moderationActionSchema.parse(req.body);

    if (!req.currentUser) {
        return res.status(500).json({
            error: { code: 'INTERNAL', message: 'currentUser not loaded' },
        });
    }

    const updated = await approveMedia({
        mediaId: id,
        moderatorId: req.currentUser.id,
        notes: body.notes,
        requestId: req.requestId,
    });

    res.json({
        status: 'ok',
        mediaId: updated.id,
        moderationStatus: updated.moderationStatus,
    });
});

export const reject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = moderationActionSchema.parse(req.body);

    if (!req.currentUser) {
        return res.status(500).json({
            error: { code: 'INTERNAL', message: 'currentUser not loaded' },
        });
    }

    const updated = await rejectMedia({
        mediaId: id,
        moderatorId: req.currentUser.id,
        notes: body.notes,
        requestId: req.requestId,
    });

    res.json({
        status: 'ok',
        mediaId: updated.id,
        moderationStatus: updated.moderationStatus,
    });
});
