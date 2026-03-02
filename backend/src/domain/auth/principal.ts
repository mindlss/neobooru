import { prisma } from '../../lib/prisma';

export type Principal = { id: string; permissions?: string[] } | undefined;

export async function getPrincipalPermissions(
    principal: Principal,
): Promise<string[]> {
    if (!principal?.id) return [];

    if (Array.isArray(principal.permissions)) {
        return principal.permissions;
    }

    const rows = await prisma.permission.findMany({
        where: {
            roles: {
                some: {
                    role: {
                        assignments: { some: { userId: principal.id } },
                    },
                },
            },
        },
        select: { key: true },
    });

    return Array.from(new Set(rows.map((r) => r.key)));
}
