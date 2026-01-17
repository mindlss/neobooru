import {
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

import { requireCurrentUser } from '../tsoa/context';
import { requireNotBanned, requireNoActiveRestriction } from '../tsoa/guards';

import type { OkDTO } from '../dto/common.dto';

import { mediaIdParamsSchema } from '../schemas/media.schemas';
import {
    addFavorite,
    removeFavorite,
} from '../../domain/media/favorites.service';

@Route('media')
@Tags('Favorites')
export class FavoritesController extends Controller {
    /**
     * POST /media/:id/favorite
     */
    @Post('{id}/favorite')
    @Security('cookieAuth')
    public async favorite(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser?.id, [
            RestrictionType.FULL_BAN,
        ]);

        const params = mediaIdParamsSchema.parse({ id });

        await addFavorite({
            userId: req.currentUser!.id,
            mediaId: params.id,
        });

        return { status: 'ok' };
    }

    /**
     * DELETE /media/:id/favorite
     */
    @Delete('{id}/favorite')
    @Security('cookieAuth')
    public async unfavorite(
        @Path() id: string,
        @Request() req: ExpressRequest,
    ): Promise<OkDTO> {
        await requireCurrentUser(req);

        requireNotBanned(req.currentUser);

        await requireNoActiveRestriction(req.currentUser?.id, [
            RestrictionType.FULL_BAN,
        ]);

        const params = mediaIdParamsSchema.parse({ id });

        await removeFavorite({
            userId: req.currentUser!.id,
            mediaId: params.id,
        });

        return { status: 'ok' };
    }
}
