import { defineConfig } from 'orval';

export default defineConfig({
    api: {
        input: {
            target: '../openapi/openapi.json',
        },
        output: {
            client: 'react-query',
            httpClient: 'axios',
            mode: 'tags-split',
            target: 'src/shared/api/generated/endpoints.ts',
            schemas: 'src/shared/api/generated/model',
            override: {
                mutator: {
                    path: 'src/shared/api/orvalMutator.ts',
                    name: 'orvalMutator',
                },
            },
        },
    },
});
