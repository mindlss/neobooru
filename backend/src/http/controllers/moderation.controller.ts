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
    if (!req.user?.id)
        return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const { id } = req.params;
    const body = moderationActionSchema.parse(req.body);

    try {
        const updated = await approveMedia({
            mediaId: id,
            moderatorId: req.user.id,
            notes: body.notes,
        });

        res.json({
            status: 'ok',
            mediaId: updated.id,
            moderationStatus: updated.moderationStatus,
        });
    } catch {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
});

export const reject = asyncHandler(async (req, res) => {
    if (!req.user?.id)
        return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const { id } = req.params;
    const body = moderationActionSchema.parse(req.body);

    try {
        const updated = await rejectMedia({
            mediaId: id,
            moderatorId: req.user.id,
            notes: body.notes,
        });

        res.json({
            status: 'ok',
            mediaId: updated.id,
            moderationStatus: updated.moderationStatus,
        });
    } catch {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
});
