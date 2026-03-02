import type { AxiosRequestConfig, AxiosError } from 'axios';
import { api } from './axios';

export const orvalMutator = async <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig,
): Promise<T> => {
    const res = await api.request<T>({ ...config, ...options });
    return res.data;
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
