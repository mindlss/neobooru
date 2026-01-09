export type ModerationQueueItemDTO = {
    id: string;
    type: 'IMAGE' | 'VIDEO';
    contentType: string;
    size: number;
    createdAt: string;
    isExplicit: boolean;
    moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export function toModerationQueueItemDTO(m: any): ModerationQueueItemDTO {
    return {
        id: m.id,
        type: m.type,
        contentType: m.contentType,
        size: m.size,
        createdAt: new Date(m.createdAt).toISOString(),
        isExplicit: m.isExplicit,
        moderationStatus: m.moderationStatus,
    };
}
