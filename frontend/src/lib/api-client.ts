import { getAccessToken, refreshAccessToken } from '@frontend/src/lib/auth';

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        request_id: string;
        [key: string]: unknown;
    };
}

class ApiError extends Error {
    code: string;
    status: number;
    details?: unknown;

    constructor(code: string, message: string, status: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

const BASE_URL = '/api';

async function makeRequest<T>(
    method: string,
    path: string,
    options?: {
        body?: unknown;
        params?: Record<string, string>;
        skipAuth?: boolean;
    }
): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`, window.location.origin);

    if (options?.params) {
        Object.entries(options.params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Inject Authorization header if token exists
    if (!options?.skipAuth) {
        const token = getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    const fetchOptions: RequestInit = {
        method,
        headers,
    };

    if (options?.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
    }

    let response = await fetch(url.toString(), fetchOptions);

    // On 401: attempt token refresh and retry once
    if (response.status === 401 && !options?.skipAuth) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetchOptions.headers = headers;
            response = await fetch(url.toString(), fetchOptions);
        }
    }

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
        throw new ApiError(
            data.error?.code || 'UNKNOWN_ERROR',
            data.error?.message || 'An unexpected error occurred',
            response.status,
            data.error?.details
        );
    }

    return data.data as T;
}

export const apiClient = {
    get<T>(path: string, params?: Record<string, string>): Promise<T> {
        return makeRequest<T>('GET', path, { params });
    },

    post<T>(path: string, body?: unknown, options?: { skipAuth?: boolean }): Promise<T> {
        return makeRequest<T>('POST', path, { body, skipAuth: options?.skipAuth });
    },

    patch<T>(path: string, body?: unknown): Promise<T> {
        return makeRequest<T>('PATCH', path, { body });
    },

    delete<T>(path: string): Promise<T> {
        return makeRequest<T>('DELETE', path);
    },
};

export { ApiError };
export type { ApiResponse };
