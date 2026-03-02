import {
    Body,
    Controller,
    Delete,
    Path,
    Post,
    Request,
    Route,
    Security,
    Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';

import { RestrictionType } from '@prisma/client';

import { apiError } from '../errors/ApiError';
import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned } from '../tsoa/guards';

import { prisma } from '../../lib/prisma';

import { mediaIdParamsSchema } from '../schemas/media.schemas';
import { setRatingSchema } from '../schemas/ratings.schemas';

import { removeRating, setRating } from '../../domain/ratings/ratings.service';

import type {
    RateMediaResponseDTO,
    SetRatingBodyDTO,
} from '../dto/ratings.dto';

import { Permission } from '../../domain/auth/permissions';

async function requireNoActiveRestriction(
    userId: string,
    types: RestrictionType[],
) {
    const now = new Date();

    const restriction = await prisma.restriction.findFirst({
        where: {
            userId,
            isActive: true,
            type: { in: types },
        },
        orderBy: { issuedAt: 'desc' },
    });

    if (!restriction) return;

    if (restriction.expiresAt && restriction.expiresAt <= now) {
        await prisma.restriction.update({
            where: { id: restriction.id },
            data: { isActive: false, revokedAt: now },
        });
        return;
    }

    throw apiError(403, 'RESTRICTED', 'Action is restricted', {
        restriction: {
            type: restriction.type,
            reason: restriction.reason,
            customReason: restriction.customReason,
            expiresAt: restriction.expiresAt,
        },
    });
}

@Route('media')
@Tags('Ratings')
export class RatingsController extends Controller {
    /**
     * POST /media/:id/rating
     * скрываем через permission
     */
    @Post('{id}/rating')
    @Security('cookieAuth', [Permission.RATINGS_SET])
    public async rateMedia(
        @Path() id: string,
        @Body() body: SetRatingBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<RateMediaResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser!.id, [
            RestrictionType.RATING_BAN,
            RestrictionType.FULL_BAN,
        ]);

        const params = mediaIdParamsSchema.parse({ id });
        const parsedBody = setRatingSchema.parse(body);

        try {
            const result = await setRating({
                mediaId: params.id,
                userId: req.currentUser!.id,
                value: parsedBody.value,
                principal: req.user,
            });

            return { status: 'ok', ...result };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            throw e;
        }
    }

    /**
     * DELETE /media/:id/rating
     * скрываем через permission
     */
    @Delete('{id}/rating')
    @Security('cookieAuth', [Permission.RATINGS_REMOVE])
    public async unrateMedia(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<RateMediaResponseDTO> {
        await requireCurrentUser(req);
        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser!.id, [
            RestrictionType.RATING_BAN,
            RestrictionType.FULL_BAN,
        ]);

        const params = mediaIdParamsSchema.parse({ id });

        try {
            const result = await removeRating({
                mediaId: params.id,
                userId: req.currentUser!.id,
                principal: req.user,
            });

            return { status: 'ok', ...result };
        } catch (e: any) {
            if (e?.message === 'NOT_FOUND') {
                throw apiError(404, 'NOT_FOUND', 'Media not found');
            }
            throw e;
        }
    }
}
