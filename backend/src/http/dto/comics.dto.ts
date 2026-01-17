export type ComicStatusDTO = 'WIP' | 'FINISHED' | 'DEAD';

export type ComicTagDTO = {
    id: string;
    name: string;
    isExplicit: boolean;
};

export type ComicPageDTO = {
    mediaId: string;
    position: number;
    addedAt: string;
};

export type ComicDTO = {
    id: string;
    title: string;
    status: ComicStatusDTO;
    createdById: string;

    coverMediaId: string | null;

    lastPageAddedAt: string | null;
    lastPageMediaId: string | null;

    randomKey: number;
    isExplicit: boolean;

    ratingAvg: number;
    ratingCount: number;

    createdAt: string;
    updatedAt: string;

    pages: ComicPageDTO[];
    tags: ComicTagDTO[];
};

export function toComicDTO(c: any): ComicDTO {
    return {
        id: c.id,
        title: c.title,
        status: c.status,
        createdById: c.createdById,

        coverMediaId: c.coverMediaId ?? null,

        lastPageAddedAt: c.lastPageAddedAt
            ? new Date(c.lastPageAddedAt).toISOString()
            : null,
        lastPageMediaId: c.lastPageMediaId ?? null,

        randomKey: c.randomKey,
        isExplicit: !!c.isExplicit,

        ratingAvg: typeof c.ratingAvg === 'number' ? c.ratingAvg : 0,
        ratingCount: typeof c.ratingCount === 'number' ? c.ratingCount : 0,

        createdAt: new Date(c.createdAt).toISOString(),
        updatedAt: new Date(c.updatedAt).toISOString(),

        pages: Array.isArray(c.pages)
            ? c.pages.map((p: any) => ({
                  mediaId: p.mediaId,
                  position: p.position,
                  addedAt: new Date(p.addedAt).toISOString(),
              }))
            : [],
        tags: Array.isArray(c.tags)
            ? c.tags.map((t: any) => ({
                  id: t.id,
                  name: t.name,
                  isExplicit: !!t.isExplicit,
              }))
            : [],
    };
}

export type CreateComicBodyDTO = {
    title: string;
};

export type UpdateComicBodyDTO = {
    title?: string;
    status?: ComicStatusDTO;
    coverMediaId?: string | null;
};

export type AddComicPageBodyDTO = {
    mediaId: string;
    position?: number;
};

export type ReorderComicPagesBodyDTO = {
    orderedMediaIds: string[];
};

export type ComicIdParamsDTO = { id: string };
export type RemoveComicPageParamsDTO = { id: string; mediaId: string };

export type ComicResponseDTO = { data: ComicDTO };

export type OkResponseDTO = { ok: true };
