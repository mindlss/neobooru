import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
    __isRetryRequest?: boolean;
};

export const api = axios.create({
    baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api',
    withCredentials: true,
});

let refreshPromise: Promise<unknown> | null = null;

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as RetriableRequestConfig | undefined;
        const status = error.response?.status;
        const url = String(original?.url ?? '');

        if (
            status !== 401 ||
            !original ||
            original.__isRetryRequest ||
            url.includes('/auth/refresh') ||
            url.includes('/auth/login') ||
            url.includes('/auth/register')
        ) {
            return Promise.reject(error);
        }

        original.__isRetryRequest = true;
        refreshPromise ??= api
            .post('/auth/refresh')
            .finally(() => {
                refreshPromise = null;
            });

        await refreshPromise;
        return api.request(original);
    },
);
