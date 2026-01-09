export type TagPublicDTO = {
    id: string;
    name: string;
    color: string;
    addedAt?: string;
};

export function toTagPublicDTO(tag: {
    id: string;
    name: string;
    color: string;
    addedAt?: Date | string | null;
}): TagPublicDTO {
    return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        ...(tag.addedAt
            ? { addedAt: new Date(tag.addedAt).toISOString() }
            : {}),
    };
}
