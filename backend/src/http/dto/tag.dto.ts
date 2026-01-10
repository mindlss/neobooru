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

export type TagSuggestDTO = {
    kind: 'tag' | 'alias';
    id: string;
    name: string;
    usageCount: number;
    color: string;
    categoryName?: string;

    canonicalId: string;
    canonicalName: string;
};

export type TagAdminDTO = TagSearchDTO & {
    categoryId: string;
    customColor: string | null;
    isExplicit: boolean;
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

export function toTagSuggestDTO(t: any): TagSuggestDTO {
    return {
        kind: t.kind,
        id: t.id,
        name: t.name,
        color: t.color,
        usageCount: t.usageCount ?? 0,
        ...(t.categoryName ? { categoryName: t.categoryName } : {}),
        canonicalId: t.canonicalId,
        canonicalName: t.canonicalName,
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
        isExplicit: !!t.isExplicit,
    };
}
