import { UserRole } from '@prisma/client';

export type UserSelfDTO = {
    id: string;
    username: string;
    email: string;
    role: UserRole;
};

export function toUserSelfDTO(u: any): UserSelfDTO {
    return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
    };
}
