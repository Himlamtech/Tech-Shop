const ACCESS_TOKEN_KEY = 'techshop_access_token';
const REFRESH_TOKEN_KEY = 'techshop_refresh_token';

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Decode a JWT payload without verifying signature (client-side only).
 */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch {
        return null;
    }
}

/**
 * Check if the stored access token exists and is not expired.
 */
export function isAuthenticated(): boolean {
    const token = getAccessToken();
    if (!token) return false;

    const payload = decodeTokenPayload(token);
    if (!payload || typeof payload.exp !== 'number') return false;

    // Check expiration with a 30-second buffer
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now + 30;
}

/**
 * Extract user info from the access token payload.
 */
export function getUserFromToken(): { id: string; email: string; role: string } | null {
    const token = getAccessToken();
    if (!token) return null;

    const payload = decodeTokenPayload(token);
    if (!payload) return null;

    return {
        id: (payload.user_id as string) || '',
        email: (payload.email as string) || '',
        role: (payload.role as string) || 'customer',
    };
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success, or null on failure.
 */
export async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
            clearTokens();
            return null;
        }

        const data = await response.json();
        if (data.success && data.data) {
            const { access_token, refresh_token } = data.data;
            setAccessToken(access_token);
            if (refresh_token) {
                setRefreshToken(refresh_token);
            }
            return access_token;
        }

        clearTokens();
        return null;
    } catch {
        clearTokens();
        return null;
    }
}

/**
 * Logout: clear all stored tokens.
 */
export function logout(): void {
    clearTokens();
}
