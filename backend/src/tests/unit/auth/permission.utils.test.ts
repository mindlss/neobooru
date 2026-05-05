import { describe, expect, it } from 'vitest';

import {
    assertAllPermissions,
    assertAnyPermission,
    assertPermission,
    getPermissions,
    hasAllPermissions,
    hasAnyPermission,
    hasPermission,
} from '../../../domain/auth/permission.utils';
import { Permission } from '../../../domain/auth/permissions';

describe('permission utils', () => {
    const principal = {
        id: 'user-1',
        permissions: [
            Permission.MEDIA_READ_EXPLICIT,
            Permission.COMMENTS_CREATE,
        ],
    };

    it('returns an empty permissions list for missing principals', () => {
        expect(getPermissions(undefined)).toEqual([]);
        expect(getPermissions({ id: 'user-1' })).toEqual([]);
    });

    it('checks a single permission', () => {
        expect(hasPermission(principal, Permission.MEDIA_READ_EXPLICIT)).toBe(
            true,
        );
        expect(hasPermission(principal, Permission.COMMENTS_DELETE_ANY)).toBe(
            false,
        );
        expect(hasPermission(undefined, Permission.COMMENTS_CREATE)).toBe(
            false,
        );
    });

    it('checks all required permissions', () => {
        expect(
            hasAllPermissions(principal, [
                Permission.MEDIA_READ_EXPLICIT,
                Permission.COMMENTS_CREATE,
            ]),
        ).toBe(true);
        expect(
            hasAllPermissions(principal, [
                Permission.MEDIA_READ_EXPLICIT,
                Permission.COMMENTS_DELETE_ANY,
            ]),
        ).toBe(false);
    });

    it('checks any required permission', () => {
        expect(
            hasAnyPermission(principal, [
                Permission.COMMENTS_DELETE_ANY,
                Permission.COMMENTS_CREATE,
            ]),
        ).toBe(true);
        expect(
            hasAnyPermission(principal, [
                Permission.COMMENTS_DELETE_ANY,
                Permission.COMMENTS_DELETE_OWN,
            ]),
        ).toBe(false);
    });

    it('throws FORBIDDEN from assertion helpers when permissions are missing', () => {
        expect(() =>
            assertPermission(principal, Permission.COMMENTS_CREATE),
        ).not.toThrow();
        expect(() =>
            assertPermission(principal, Permission.COMMENTS_DELETE_ANY),
        ).toThrow('FORBIDDEN');

        expect(() =>
            assertAllPermissions(principal, [
                Permission.MEDIA_READ_EXPLICIT,
                Permission.COMMENTS_CREATE,
            ]),
        ).not.toThrow();
        expect(() =>
            assertAllPermissions(principal, [
                Permission.MEDIA_READ_EXPLICIT,
                Permission.COMMENTS_DELETE_ANY,
            ]),
        ).toThrow('FORBIDDEN');

        expect(() =>
            assertAnyPermission(principal, [
                Permission.COMMENTS_DELETE_ANY,
                Permission.COMMENTS_CREATE,
            ]),
        ).not.toThrow();
        expect(() =>
            assertAnyPermission(principal, [
                Permission.COMMENTS_DELETE_ANY,
                Permission.COMMENTS_DELETE_OWN,
            ]),
        ).toThrow('FORBIDDEN');
    });
});
