import type { UserSelfDTO } from './user.dto';
import { toUserSelfDTO } from './user.dto';

export type RegisterBodyDTO = {
    username: string;
    email: string;
    password: string;
};

export type LoginBodyDTO = {
    email: string;
    password: string;
};

export type AuthResponseDTO = {
    user: UserSelfDTO;
};

export function toAuthResponseDTO(input: { user: any }): AuthResponseDTO {
    return {
        user: toUserSelfDTO(input.user),
    };
}
