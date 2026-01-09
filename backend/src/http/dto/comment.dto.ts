import { UserRole, CommentDeletedKind } from '@prisma/client';

type Viewer = { role: UserRole } | undefined;

export type CommentAuthorDTO = {
    id: string;
    username: string;
    role: UserRole;
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

    const canSeeReason =
        viewer?.role === UserRole.MODERATOR || viewer?.role === UserRole.ADMIN;

    return {
        id: c.id,
        mediaId: c.mediaId,
        userId: c.userId,
        parentId: c.parentId ?? null,

        content: isDeleted ? null : c.content,
        isDeleted,
        deletedKind: c.deletedKind ?? null,
        deletedReason:
            isDeleted && canSeeReason ? c.deletedReason ?? null : null,

        createdAt: new Date(c.createdAt).toISOString(),

        user: {
            id: c.user.id,
            username: c.user.username,
            role: c.user.role,
        },
    };
}
