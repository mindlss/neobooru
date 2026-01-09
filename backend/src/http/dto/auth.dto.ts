import type { UserSelfDTO } from './user.dto';
import { toUserSelfDTO } from './user.dto';

export type AuthResponseDTO = {
    user: UserSelfDTO;
    accessToken: string;
};

export function toAuthResponseDTO(input: {
    user: any;
    token: string;
}): AuthResponseDTO {
    return {
        user: toUserSelfDTO(input.user),
        accessToken: input.token,
    };
}
