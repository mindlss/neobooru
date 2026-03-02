import { CommentDeletedKind } from '@prisma/client';
import { Permission } from '../../domain/auth/permissions';
import type { PrincipalLike } from '../../domain/auth/permission.utils';
import { hasPermission } from '../../domain/auth/permission.utils';

type Viewer = PrincipalLike | undefined;

export type CommentAuthorDTO = {
    id: string;
    username: string;
};

export type CommentDTO = {
    id: string;
    mediaId: string;
    userId: string;
    parentId: string | null;

    content: string | null;
    isDeleted: boolean;
    deletedKind: CommentDeletedKind | null;
    deletedReason: string | null;

    createdAt: string;

    user: CommentAuthorDTO;
};

export function toCommentDTO(c: any, viewer: Viewer): CommentDTO {
    const isDeleted = !!c.deletedAt;

    const canSeeReason = hasPermission(
        viewer,
        Permission.COMMENTS_READ_DELETION_REASON,
    );

    return {
        id: c.id,
        mediaId: c.mediaId,
        userId: c.userId,
        parentId: c.parentId ?? null,

        content: isDeleted ? null : c.content,
        isDeleted,
        deletedKind: c.deletedKind ?? null,
        deletedReason:
            isDeleted && canSeeReason ? (c.deletedReason ?? null) : null,

        createdAt: new Date(c.createdAt).toISOString(),

        user: {
            id: c.user.id,
            username: c.user.username,
        },
    };
}
