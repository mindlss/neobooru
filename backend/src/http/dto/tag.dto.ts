export type TagPublicDTO = {
    id: string;
    name: string;
    color: string;
    addedAt?: string;
};

export type TagSearchDTO = {
    id: string;
    name: string;
    color: string;
    usageCount: number;
    categoryName?: string;
};

export type TagAdminDTO = TagSearchDTO & {
    categoryId: string;
    customColor: string | null;
};

export function toTagPublicDTO(t: any): TagPublicDTO {
    return {
        id: t.id,
        name: t.name,
        color: t.color,
        ...(t.addedAt ? { addedAt: new Date(t.addedAt).toISOString() } : {}),
    };
}

export function toTagSearchDTO(t: any): TagSearchDTO {
    return {
        id: t.id,
        name: t.name,
        color: t.color,
        usageCount: t.usageCount ?? 0,
        ...(t.categoryName ? { categoryName: t.categoryName } : {}),
    };
}

export function toTagAdminDTO(t: any): TagAdminDTO {
    return {
        id: t.id,
        name: t.name,
        color: t.color,
        usageCount: t.usageCount ?? 0,
        categoryName: t.categoryName,
        categoryId: t.categoryId,
        customColor: t.customColor ?? null,
    };
}
