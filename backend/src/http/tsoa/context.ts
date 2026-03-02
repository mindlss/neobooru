import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { apiError } from '../errors/ApiError';

export function computeIsAdult(birthDate: Date | null | undefined): boolean {
  if (!birthDate) return false;

  const now = new Date();
  const eighteenYearsAgo = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate(),
  );

  return birthDate <= eighteenYearsAgo;
}

/**
 * Loads full current user.
 * Throws 401 if auth missing or user not found/deleted.
 */
export async function requireCurrentUser(req: Request) {
  if (!req.user?.id) throw apiError(401, 'UNAUTHORIZED', 'Missing auth');

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || user.deletedAt) {
    throw apiError(401, 'UNAUTHORIZED', 'User not found');
  }

  req.currentUser = user;
  return user;
}

/**
 * Optional viewer object for age-gates and ownership checks.
 * Does NOT mutate req and does NOT throw.
 */
export async function loadViewer(req: Request): Promise<
  | {
      id: string;
      isAdult: boolean;
    }
  | undefined
> {
  if (!req.user?.id) return undefined;

  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, birthDate: true, deletedAt: true },
    });

    if (!u || u.deletedAt) return undefined;

    return {
      id: u.id,
      isAdult: computeIsAdult(u.birthDate),
    };
  } catch {
    return undefined;
  }
}