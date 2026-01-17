import { UserRole } from '@prisma/client';

import type {
    MediaPublicDTO,
    MediaUserDTO,
    MediaModeratorDTO,
    MediaVisibleDTO,
} from './media.dto';
import { CommentDTO } from './comment.dto';

export type UserPublicDTO = {
    id: string;
    username: string;
    role: UserRole;

    avatarUrl: string | null;
    bio: string | null;
    website: string | null;

    createdAt: string;
};

export function toUserPublicDTO(u: any): UserPublicDTO {
    return {
        id: u.id,
        username: u.username,
        role: u.role,

        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? null,
        website: u.website ?? null,

        createdAt: new Date(u.createdAt).toISOString(),
    };
}

export type UserSelfDTO = {
    id: string;
    username: string;
    email: string;
    role: UserRole;

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
};

export function toUserSelfDTO(u: any): UserSelfDTO {
    return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,

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
