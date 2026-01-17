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
import { requireNotBanned, requireNoActiveRestriction } from '../tsoa/guards';

import { mediaIdParamsSchema } from '../schemas/media.schemas';
import { setRatingSchema } from '../schemas/ratings.schemas';

import { removeRating, setRating } from '../../domain/ratings/ratings.service';

import type {
    RateMediaResponseDTO,
    SetRatingBodyDTO,
} from '../dto/ratings.dto';

@Route('media')
@Tags('Ratings')
export class RatingsController extends Controller {
    /**
     * POST /media/:id/rating
     */
    @Post('{id}/rating')
    @Security('cookieAuth')
    public async rateMedia(
        @Path() id: string,
        @Body() body: SetRatingBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<RateMediaResponseDTO> {
        await requireCurrentUser(req);

        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser?.id, [
            RestrictionType.RATING_BAN,
            RestrictionType.FULL_BAN,
        ]);

        if (!req.viewer?.id) {
            throw apiError(500, 'INTERNAL_SERVER_ERROR', 'viewer not loaded');
        }

        const params = mediaIdParamsSchema.parse({ id });
        const parsedBody = setRatingSchema.parse(body);

        try {
            const result = await setRating({
                mediaId: params.id,
                userId: req.currentUser!.id,
                value: parsedBody.value,
                viewer: {
                    id: req.viewer.id,
                    role: req.viewer.role,
                    isAdult: req.viewer.isAdult,
                },
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
     */
    @Delete('{id}/rating')
    @Security('cookieAuth')
    public async unrateMedia(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<RateMediaResponseDTO> {
        await requireCurrentUser(req);

        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser?.id, [
            RestrictionType.RATING_BAN,
            RestrictionType.FULL_BAN,
        ]);

        if (!req.viewer?.id) {
            throw apiError(500, 'INTERNAL_SERVER_ERROR', 'viewer not loaded');
        }

        const params = mediaIdParamsSchema.parse({ id });

        try {
            const result = await removeRating({
                mediaId: params.id,
                userId: req.currentUser!.id,
                viewer: {
                    id: req.viewer.id,
                    role: req.viewer.role,
                    isAdult: req.viewer.isAdult,
                },
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
