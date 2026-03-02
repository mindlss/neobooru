import { Permission } from './permissions';

export type PrincipalLike = {
    id: string;
    permissions?: string[];
};

/**
 * Safe permissions getter.
 * Never returns undefined.
 */
export function getPermissions(p: PrincipalLike | undefined): string[] {
    if (!p?.permissions) return [];
    return p.permissions;
}

/**
 * Checks if principal has specific permission.
 */
export function hasPermission(
    p: PrincipalLike | undefined,
    perm: Permission,
): boolean {
    if (!p) return false;
    return getPermissions(p).includes(perm);
}

/**
 * Checks if principal has ALL permissions.
 */
export function hasAllPermissions(
    p: PrincipalLike | undefined,
    required: Permission[],
): boolean {
    if (!p) return false;
    const perms = getPermissions(p);
    return required.every((r) => perms.includes(r));
}

/**
 * Checks if principal has ANY permission from list.
 */
export function hasAnyPermission(
    p: PrincipalLike | undefined,
    required: Permission[],
): boolean {
    if (!p) return false;
    const perms = getPermissions(p);
    return required.some((r) => perms.includes(r));
}

/**
 * Throws if permission missing.
 * Domain-level guard.
 */
export function assertPermission(
    p: PrincipalLike | undefined,
    perm: Permission,
) {
    if (!hasPermission(p, perm)) {
        throw new Error('FORBIDDEN');
    }
}

/**
 * Throws if missing ALL permissions.
 */
export function assertAllPermissions(
    p: PrincipalLike | undefined,
    required: Permission[],
) {
    if (!hasAllPermissions(p, required)) {
        throw new Error('FORBIDDEN');
    }
}

/**
 * Throws if missing ANY permission from list.
 */
export function assertAnyPermission(
    p: PrincipalLike | undefined,
    required: Permission[],
) {
    if (!hasAnyPermission(p, required)) {
        throw new Error('FORBIDDEN');
    }
}
