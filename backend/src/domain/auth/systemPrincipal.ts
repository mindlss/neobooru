import type { PrincipalLike } from './permission.utils';

export const SYSTEM_PRINCIPAL_ID = 'system';

export const SYSTEM_PRINCIPAL: PrincipalLike = {
    id: SYSTEM_PRINCIPAL_ID,
    permissions: [
        'media.tags_edit_any',
        'media.read_explicit',
        'tags.manage',
        'tags.aliases_manage',
    ],
};
