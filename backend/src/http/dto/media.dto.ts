import { toTagPublicDTO, type TagPublicDTO } from './tag.dto';
import { Permission } from '../../domain/auth/permissions';

type Viewer = { permissions?: string[] } | undefined;

function has(viewer: Viewer, perm: Permission) {
    return !!viewer?.permissions?.includes(perm);
}

export type MediaVisibleDTO = MediaPublicDTO | MediaUserDTO | MediaModeratorDTO;

export type MediaListResponseDTO = {
    data: MediaVisibleDTO[];
    nextCursor: string | null;
};

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

/**
 * Sensitive/staff fields.
 * Show them only if viewer can actually act as staff for media.
 *
 * IMPORTANT: "read explicit" is NOT a moderation entitlement by itself,
 * so it must NOT unlock mod fields.
 */
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

function canSeeModFields(viewer: Viewer) {
    // "unmoderated" implies seeing rejected/pending + moderation notes/meta
    // "deleted" implies seeing deletedAt/deletedBy (and typically keys)
    return (
        has(viewer, Permission.MEDIA_READ_UNMODERATED) ||
        has(viewer, Permission.MEDIA_READ_DELETED)
    );
}

export function toMediaDTO(
    media: any,
    viewer: Viewer,
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
        isExplicit: !!media.isExplicit,
        createdAt: new Date(media.createdAt).toISOString(),

        previewUrl: media.previewUrl ?? null,
        tags: (media.tags ?? []).map((t: any) =>
            toTagPublicDTO({
                id: t.id,
                name: t.name,
                color: t.color,
                addedAt: t.addedAt,
            }),
        ),

        favorite: !!media.favorite,

        ratingAvg: typeof media.ratingAvg === 'number' ? media.ratingAvg : 0,
        ratingCount:
            typeof media.ratingCount === 'number' ? media.ratingCount : 0,
        myRating: typeof media.myRating === 'number' ? media.myRating : null,

        commentCount:
            typeof media.commentCount === 'number' ? media.commentCount : 0,
    };

    // guest
    if (!viewer) return base;

    // authed
    const userDto: MediaUserDTO = {
        ...base,
        originalUrl: media.originalUrl ?? null,
    };

    // staff
    if (!canSeeModFields(viewer)) return userDto;

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
