import { describe, expect, it } from 'vitest';

import { parseTags } from '../../../domain/tags/tags.parser';

describe('parseTags', () => {
    it('returns an empty list for empty input', () => {
        expect(parseTags()).toEqual([]);
        expect(parseTags('')).toEqual([]);
        expect(parseTags('   ,  ')).toEqual([]);
    });

    it('splits by commas and whitespace', () => {
        expect(parseTags('cat, dog bird\tfox\nwolf')).toEqual([
            'cat',
            'dog',
            'bird',
            'fox',
            'wolf',
        ]);
    });

    it('lowercases and deduplicates while preserving first occurrence order', () => {
        expect(parseTags('Cat dog CAT Dog fox')).toEqual([
            'cat',
            'dog',
            'fox',
        ]);
    });

    it('trims surrounding separators from tags', () => {
        expect(parseTags('  alpha,, beta   gamma,  ')).toEqual([
            'alpha',
            'beta',
            'gamma',
        ]);
    });
});
