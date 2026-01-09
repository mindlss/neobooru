import { UserRole } from '@prisma/client';
import { toTagPublicDTO, type TagPublicDTO } from './tag.dto';

type Viewer = { role: UserRole } | undefined;

export type MediaPublicDTO = {
    id: string;
    type: 'IMAGE' | 'VIDEO';
    contentType: string;
    size: number;

    width: number | null;
    height: number | null;
    duration: number | null;

    description: string | null;
    isExplicit: boolean;
    createdAt: string;

    previewUrl: string | null;
    tags: TagPublicDTO[];

    favorite: boolean;

    ratingAvg: number;
    ratingCount: number;
    myRating: number | null;

    commentCount: number;
};

export type MediaUserDTO = MediaPublicDTO & {
    originalUrl: string | null;
};

export type MediaModeratorDTO = MediaUserDTO & {
    hash: string;

    moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    moderatedAt: string | null;
    moderatedById: string | null;
    moderationNotes: string | null;

    deletedAt: string | null;
    deletedBy: string | null;

    originalKey: string;
    previewKey: string | null;
};

export function toMediaDTO(
    media: any,
    viewer: Viewer
): MediaPublicDTO | MediaUserDTO | MediaModeratorDTO {
    const base: MediaPublicDTO = {
        id: media.id,
        type: media.type,
        contentType: media.contentType,
        size: media.size,

        width: media.width ?? null,
        height: media.height ?? null,
        duration: media.duration ?? null,

        description: media.description ?? null,
        isExplicit: media.isExplicit,
        createdAt: new Date(media.createdAt).toISOString(),

        previewUrl: media.previewUrl ?? null,
        tags: (media.tags ?? []).map((t: any) =>
            toTagPublicDTO({
                id: t.id,
                name: t.name,
                color: t.color,
                addedAt: t.addedAt,
            })
        ),

        favorite: !!media.favorite,

        ratingAvg: typeof media.ratingAvg === 'number' ? media.ratingAvg : 0,
        ratingCount:
            typeof media.ratingCount === 'number' ? media.ratingCount : 0,
        myRating: typeof media.myRating === 'number' ? media.myRating : null,

        commentCount:
            typeof media.commentCount === 'number' ? media.commentCount : 0,
    };

    if (!viewer) return base;

    const userDto: MediaUserDTO = {
        ...base,
        originalUrl: media.originalUrl ?? null,
    };

    if (viewer.role === UserRole.MODERATOR || viewer.role === UserRole.ADMIN) {
        const modDto: MediaModeratorDTO = {
            ...userDto,
            hash: media.hash,

            moderationStatus: media.moderationStatus,
            moderatedAt: media.moderatedAt
                ? new Date(media.moderatedAt).toISOString()
                : null,
            moderatedById: media.moderatedById ?? null,
            moderationNotes: media.moderationNotes ?? null,

            deletedAt: media.deletedAt
                ? new Date(media.deletedAt).toISOString()
                : null,
            deletedBy: media.deletedBy ?? null,

            originalKey: media.originalKey,
            previewKey: media.previewKey ?? null,
        };

        return modDto;
    }

    return userDto;
}

export type MediaUploadDTO = {
    id: string;
    type: 'IMAGE' | 'VIDEO';
    contentType: string;
    size: number;
    moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
};

export function toMediaUploadDTO(m: any): MediaUploadDTO {
    return {
        id: m.id,
        type: m.type,
        contentType: m.contentType,
        size: m.size,
        moderationStatus: m.moderationStatus,
        createdAt: new Date(m.createdAt).toISOString(),
    };
}
