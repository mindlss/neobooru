export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Neobooru API',
        version: '0.0.1',
        description: 'OpenAPI specification for Neobooru backend endpoints.',
    },
    servers: [{ url: '/' }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
    tags: [
        { name: 'health' },
        { name: 'db' },
        { name: 'storage' },
        { name: 'auth' },
        { name: 'media' },
        { name: 'moderation' },
        { name: 'tags' },
        { name: 'users' },
        { name: 'comments' },
        { name: 'reports' },
        { name: 'jobs' },
        { name: 'comics' },
        { name: 'search' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['health'],
                summary: 'Health check',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/db/ping': {
            get: {
                tags: ['db'],
                summary: 'Database ping',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/storage/ping': {
            get: {
                tags: ['storage'],
                summary: 'Storage (MinIO) ping',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/auth/register': {
            post: {
                tags: ['auth'],
                summary: 'Register',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/auth/login': {
            post: {
                tags: ['auth'],
                summary: 'Login',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media': {
            get: {
                tags: ['media'],
                summary: 'List media',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}': {
            get: {
                tags: ['media'],
                summary: 'Get media by ID',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/upload': {
            post: {
                tags: ['media'],
                summary: 'Upload media',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/favorite': {
            post: {
                tags: ['media'],
                summary: 'Favorite media',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
            delete: {
                tags: ['media'],
                summary: 'Unfavorite media',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/rating': {
            post: {
                tags: ['media'],
                summary: 'Rate media',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
            delete: {
                tags: ['media'],
                summary: 'Remove media rating',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/moderation/queue': {
            get: {
                tags: ['moderation'],
                summary: 'Moderation queue',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/moderation/media/{id}/approve': {
            post: {
                tags: ['moderation'],
                summary: 'Approve media',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/moderation/media/{id}/reject': {
            post: {
                tags: ['moderation'],
                summary: 'Reject media',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags/search': {
            get: {
                tags: ['tags'],
                summary: 'Search tags',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags/popular': {
            get: {
                tags: ['tags'],
                summary: 'Popular tags',
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags': {
            post: {
                tags: ['tags'],
                summary: 'Create tag',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags/{id}': {
            patch: {
                tags: ['tags'],
                summary: 'Update tag',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags/{id}/aliases': {
            get: {
                tags: ['tags'],
                summary: 'List tag aliases',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
            post: {
                tags: ['tags'],
                summary: 'Create tag alias',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/tags/aliases/{id}': {
            delete: {
                tags: ['tags'],
                summary: 'Delete tag alias',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/tags': {
            post: {
                tags: ['tags'],
                summary: 'Set media tags',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/tags/add': {
            post: {
                tags: ['tags'],
                summary: 'Add media tags',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/tags/remove': {
            post: {
                tags: ['tags'],
                summary: 'Remove media tags',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/{id}': {
            get: {
                tags: ['users'],
                summary: 'Get public user profile',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/{id}/uploads': {
            get: {
                tags: ['users'],
                summary: 'Get user uploads',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/{id}/favorites': {
            get: {
                tags: ['users'],
                summary: 'Get user favorites',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/{id}/comments': {
            get: {
                tags: ['users'],
                summary: 'Get user comments',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/{id}/ratings': {
            get: {
                tags: ['users'],
                summary: 'Get user ratings',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/me': {
            get: {
                tags: ['users'],
                summary: 'Get current user',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
            patch: {
                tags: ['users'],
                summary: 'Update current user',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/users/me/avatar': {
            post: {
                tags: ['users'],
                summary: 'Upload current user avatar',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/media/{id}/comments': {
            get: {
                tags: ['comments'],
                summary: 'List media comments',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
            post: {
                tags: ['comments'],
                summary: 'Create media comment',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comments/{id}': {
            delete: {
                tags: ['comments'],
                summary: 'Delete comment',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/reports': {
            post: {
                tags: ['reports'],
                summary: 'Create report',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/admin/reports': {
            get: {
                tags: ['reports'],
                summary: 'List reports (admin)',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/admin/reports/targets': {
            get: {
                tags: ['reports'],
                summary: 'Report targets summary (admin)',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/admin/reports/{id}': {
            patch: {
                tags: ['reports'],
                summary: 'Update report (admin)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/jobs': {
            get: {
                tags: ['jobs'],
                summary: 'List jobs',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/jobs/{name}/run': {
            post: {
                tags: ['jobs'],
                summary: 'Run job',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comics': {
            post: {
                tags: ['comics'],
                summary: 'Create comic',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comics/{id}': {
            get: {
                tags: ['comics'],
                summary: 'Get comic',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
            patch: {
                tags: ['comics'],
                summary: 'Update comic',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comics/{id}/pages': {
            post: {
                tags: ['comics'],
                summary: 'Add comic page',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comics/{id}/pages/{mediaId}': {
            delete: {
                tags: ['comics'],
                summary: 'Remove comic page',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'mediaId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/comics/{id}/pages/reorder': {
            post: {
                tags: ['comics'],
                summary: 'Reorder comic pages',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'OK' } },
            },
        },
        '/search': {
            get: {
                tags: ['search'],
                summary: 'Search',
                responses: { 200: { description: 'OK' } },
            },
        },
    },
} as const;
