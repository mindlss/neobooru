import type {
    MediaPublicDTO,
    MediaUserDTO,
    MediaModeratorDTO,
    MediaVisibleDTO,
} from './media.dto';
import type { CommentDTO } from './comment.dto';

export type UserPublicDTO = {
    id: string;
    username: string;

    avatarUrl: string | null;
    bio: string | null;
    website: string | null;

    createdAt: string;
};

export type UserAdminDTO = UserPublicDTO & {
    email: string;
    birthDate: string | null;

    updatedAt: string;
    emailVerifiedAt: string | null;

    showComments: boolean;
    showRatings: boolean;
    showFavorites: boolean;
    showUploads: boolean;

    uploadCount: number;
    warningCount: number;
    isBanned: boolean;

    deletedAt: string | null;
    roles: string[];
    permissions: string[];
};

export type UserVisibleDTO = UserPublicDTO | UserAdminDTO;

export function toUserPublicDTO(u: any): UserVisibleDTO {
    const base: UserPublicDTO = {
        id: u.id,
        username: u.username,

        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? null,
        website: u.website ?? null,

        createdAt: new Date(u.createdAt).toISOString(),
    };

    if (typeof u.email !== 'string') return base;

    return {
        ...base,
        email: u.email,
        birthDate: u.birthDate ? new Date(u.birthDate).toISOString() : null,
        updatedAt: new Date(u.updatedAt).toISOString(),
        emailVerifiedAt: u.emailVerifiedAt
            ? new Date(u.emailVerifiedAt).toISOString()
            : null,
        showComments: !!u.showComments,
        showRatings: !!u.showRatings,
        showFavorites: !!u.showFavorites,
        showUploads: !!u.showUploads,
        uploadCount: u.uploadCount ?? 0,
        warningCount: u.warningCount ?? 0,
        isBanned: !!u.isBanned,
        deletedAt: u.deletedAt ? new Date(u.deletedAt).toISOString() : null,
        roles: Array.isArray(u.roles) ? u.roles : [],
        permissions: Array.isArray(u.permissions) ? u.permissions : [],
    };
}

export type UserSelfDTO = {
    id: string;
    username: string;
    email: string;

    birthDate: string | null;

    avatarUrl: string | null;
    bio: string | null;
    website: string | null;

    createdAt: string;
    updatedAt: string;
    emailVerifiedAt: string | null;

    showComments: boolean;
    showRatings: boolean;
    showFavorites: boolean;
    showUploads: boolean;

    uploadCount: number;
    warningCount: number;
    isBanned: boolean;

    roles?: string[];
    permissions?: string[];
};

export function toUserSelfDTO(u: any): UserSelfDTO {
    return {
        id: u.id,
        username: u.username,
        email: u.email,

        birthDate: u.birthDate ? new Date(u.birthDate).toISOString() : null,

        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? null,
        website: u.website ?? null,

        createdAt: new Date(u.createdAt).toISOString(),
        updatedAt: new Date(u.updatedAt).toISOString(),
        emailVerifiedAt: u.emailVerifiedAt
            ? new Date(u.emailVerifiedAt).toISOString()
            : null,

        showComments: !!u.showComments,
        showRatings: !!u.showRatings,
        showFavorites: !!u.showFavorites,
        showUploads: !!u.showUploads,

        uploadCount: u.uploadCount ?? 0,
        warningCount: u.warningCount ?? 0,
        isBanned: !!u.isBanned,

        roles: Array.isArray(u.roles) ? u.roles : undefined,
        permissions: Array.isArray(u.permissions) ? u.permissions : undefined,
    };
}

export type PatchMeBodyDTO = {
    bio?: string | null;
    website?: string | null;

    showComments?: boolean;
    showRatings?: boolean;
    showFavorites?: boolean;
    showUploads?: boolean;
};

export type UserPublicResponseDTO = UserPublicDTO;
export type UserSelfResponseDTO = UserSelfDTO;

export type UserMediaVisibleDTO =
    | MediaPublicDTO
    | MediaUserDTO
    | MediaModeratorDTO;

export type UserMediaPageResponseDTO = {
    data: UserMediaVisibleDTO[];
    nextCursor: string | null;
};

export type UserMediaListResponseDTO = {
    data: MediaVisibleDTO[];
    nextCursor: string | null;
};

export type UserCommentsListResponseDTO = {
    data: CommentDTO[];
    nextCursor: string | null;
};

export type UserRatingItemDTO = {
    value: number;
    media: MediaVisibleDTO;
};

export type UserRatingsListResponseDTO = {
    data: UserRatingItemDTO[];
    nextCursor: string | null;
};
