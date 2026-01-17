import type { TagSearchDTO } from './tag.dto';

export type SearchMediaItemDTO = {
    id: string;

    type: 'IMAGE' | 'VIDEO';
    contentType: string;
    size: number;

    width: number | null;
    height: number | null;
    duration: number | null;

    description: string | null;
    isExplicit: boolean;

    ratingAvg: number;
    ratingCount: number;
    myRating: number | null;

    commentCount: number;

    hash: string;
    originalKey: string;
    previewKey: string | null;

    moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    moderatedAt: string | null;
    moderatedById: string | null;
    moderationNotes: string | null;

    uploadedById: string;

    createdAt: string;
    updatedAt: string;

    deletedAt: string | null;
    deletedBy: string | null;

    tags: Array<
        TagSearchDTO & {
            categoryId: string;
            customColor: string | null;
            addedAt: string;
        }
    >;

    favorite: boolean;

    previewUrl: string | null;
};

export type SearchComicItemDTO = {
    id: string;
    title: string;
    status: string; // enum в prisma

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

    previewUrl: string | null;
};

export type SearchMetaDTO = {
    comicMode: boolean;
    forcedByQuery: boolean;
    excludedComic: boolean;
};

export type SearchResponseDTO = {
    meta: SearchMetaDTO;
    data: Array<SearchMediaItemDTO | SearchComicItemDTO>;
    nextCursor: string | null;
};
