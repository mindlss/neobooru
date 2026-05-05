import { describe, expect, it } from 'vitest';

import { parseSearchQuery } from '../../../domain/search/search.parser';

describe('parseSearchQuery', () => {
    it('returns an empty result for blank queries', () => {
        expect(parseSearchQuery('')).toEqual({
            expr: null,
            includeComic: false,
            excludeComic: false,
            sort: undefined,
        });
    });

    it('normalizes tag names and inserts implicit AND between adjacent terms', () => {
        expect(parseSearchQuery('Big Cat cute').expr).toEqual({
            kind: 'and',
            items: [
                { kind: 'term', term: { kind: 'tag', name: 'big' } },
                { kind: 'term', term: { kind: 'tag', name: 'cat' } },
                { kind: 'term', term: { kind: 'tag', name: 'cute' } },
            ],
        });
    });

    it('parses OR, pipe shorthand, NOT, and parentheses with precedence', () => {
        expect(parseSearchQuery('cat OR dog bird').expr).toEqual({
            kind: 'or',
            items: [
                { kind: 'term', term: { kind: 'tag', name: 'cat' } },
                {
                    kind: 'and',
                    items: [
                        { kind: 'term', term: { kind: 'tag', name: 'dog' } },
                        {
                            kind: 'term',
                            term: { kind: 'tag', name: 'bird' },
                        },
                    ],
                },
            ],
        });

        expect(parseSearchQuery('(cat | dog) -bird').expr).toEqual({
            kind: 'and',
            items: [
                {
                    kind: 'or',
                    items: [
                        { kind: 'term', term: { kind: 'tag', name: 'cat' } },
                        { kind: 'term', term: { kind: 'tag', name: 'dog' } },
                    ],
                },
                {
                    kind: 'not',
                    item: {
                        kind: 'term',
                        term: { kind: 'tag', name: 'bird' },
                    },
                },
            ],
        });
    });

    it('parses numeric filters', () => {
        expect(parseSearchQuery('width:1920 height:>=1080 rating:4.5').expr)
            .toEqual({
                kind: 'and',
                items: [
                    {
                        kind: 'term',
                        term: {
                            kind: 'filter',
                            filter: {
                                kind: 'number',
                                field: 'width',
                                op: 'eq',
                                value: 1920,
                            },
                        },
                    },
                    {
                        kind: 'term',
                        term: {
                            kind: 'filter',
                            filter: {
                                kind: 'number',
                                field: 'height',
                                op: 'gte',
                                value: 1080,
                            },
                        },
                    },
                    {
                        kind: 'term',
                        term: {
                            kind: 'filter',
                            filter: {
                                kind: 'number',
                                field: 'rating',
                                op: 'eq',
                                value: 4.5,
                            },
                        },
                    },
                ],
            });
    });

    it('parses range, uploaded, ratio, and type filters', () => {
        expect(
            parseSearchQuery(
                'size:10..20 uploaded:<2024-01-02 ratio:16/9 type:video',
            ).expr,
        ).toEqual({
            kind: 'and',
            items: [
                {
                    kind: 'term',
                    term: {
                        kind: 'filter',
                        filter: {
                            kind: 'number',
                            field: 'size',
                            op: 'range',
                            min: 10,
                            max: 20,
                        },
                    },
                },
                {
                    kind: 'term',
                    term: {
                        kind: 'filter',
                        filter: {
                            kind: 'uploaded',
                            op: 'lt',
                            value: '2024-01-02',
                        },
                    },
                },
                {
                    kind: 'term',
                    term: {
                        kind: 'filter',
                        filter: {
                            kind: 'ratio',
                            op: 'eq',
                            value: 16 / 9,
                        },
                    },
                },
                {
                    kind: 'term',
                    term: {
                        kind: 'filter',
                        filter: { kind: 'type', value: 'VIDEO' },
                    },
                },
            ],
        });
    });

    it('extracts sort and comic directives without adding terms', () => {
        const result = parseSearchQuery('comic comic_page cat sort:rating');

        expect(result.includeComic).toBe(true);
        expect(result.excludeComic).toBe(false);
        expect(result.sort).toBe('rating');
        expect(result.expr).toEqual({
            kind: 'term',
            term: { kind: 'tag', name: 'cat' },
        });
    });

    it('lets -comic override comic mode', () => {
        const result = parseSearchQuery('comic -comic comic_page');

        expect(result.includeComic).toBe(false);
        expect(result.excludeComic).toBe(true);
        expect(result.expr).toEqual({
            kind: 'term',
            term: { kind: 'tag', name: 'comic_page' },
        });
    });

    it('throws for bad filters, bad sort values, and unbalanced parentheses', () => {
        expect(() => parseSearchQuery('sort:nope')).toThrow('BAD_SORT');
        expect(() => parseSearchQuery('type:audio')).toThrow('BAD_FILTER');
        expect(() => parseSearchQuery('uploaded:today')).toThrow('BAD_FILTER');
        expect(() => parseSearchQuery('(cat OR dog')).toThrow('BAD_QUERY');
    });
});
