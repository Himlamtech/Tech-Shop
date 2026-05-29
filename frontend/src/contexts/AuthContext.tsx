import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    setAccessToken,
    setRefreshToken,
    clearTokens,
    isAuthenticated as checkAuth,
    getUserFromToken,
} from '@frontend/src/lib/auth';
import { apiClient, ApiError } from '@frontend/src/lib/api-client';

interface AuthUser {
    id: string;
    email: string;
    role: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthTokenResponse {
    access_token: string;
    refresh_token: string;
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount: check stored token and restore user state
    useEffect(() => {
        if (checkAuth()) {
            const tokenUser = getUserFromToken();
            if (tokenUser) {
                setUser(tokenUser);
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const data = await apiClient.post<AuthTokenResponse>(
            '/auth/login',
            { email, password },
            { skipAuth: true }
        );

        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);

        // Extract user from response or token
        if (data.user) {
            setUser(data.user);
        } else {
            const tokenUser = getUserFromToken();
            setUser(tokenUser);
        }
    }, []);

    const register = useCallback(async (email: string, password: string) => {
        const data = await apiClient.post<AuthTokenResponse>(
            '/auth/register',
            { email, password },
            { skipAuth: true }
        );

        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);

        // Extract user from response or token
        if (data.user) {
            setUser(data.user);
        } else {
            const tokenUser = getUserFromToken();
            setUser(tokenUser);
        }
    }, []);

    const logout = useCallback(() => {
        clearTokens();
        setUser(null);
    }, []);

    const value: AuthContextValue = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export { ApiError };
