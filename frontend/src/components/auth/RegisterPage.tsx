import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '@frontend/src/contexts/AuthContext';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = (): string | null => {
        if (!email.trim()) return 'Email is required.';

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return 'Please enter a valid email address.';

        if (!password) return 'Password is required.';
        if (password.length < 8) return 'Password must be at least 8 characters.';
        if (password.length > 128) return 'Password must be at most 128 characters.';

        if (password !== confirmPassword) return 'Passwords do not match.';

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            await register(email, password);
            navigate('/', { replace: true });
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === 'VALIDATION_ERROR') {
                    // Check for duplicate email or field-level errors
                    if (typeof err.details === 'object' && err.details) {
                        const details = err.details as Record<string, string[]>;
                        if (details.email) {
                            setError(details.email[0] || 'This email is already registered.');
                        } else {
                            setError(err.message || 'Registration failed. Please check your input.');
                        }
                    } else {
                        setError(err.message || 'Registration failed. Please check your input.');
                    }
                } else {
                    setError(err.message || 'Registration failed. Please try again.');
                }
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-editorial-bg flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="bg-editorial-paper border border-editorial-text/15 p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 border border-editorial-text/20 mb-2">
                            <UserPlus className="w-5 h-5 text-editorial-text" />
                        </div>
                        <h1 className="serif text-2xl font-bold text-editorial-text">Create Account</h1>
                        <p className="text-xs text-editorial-text/60 font-sans">
                            Join TechShop to start shopping
                        </p>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-none flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label
                                htmlFor="email"
                                className="text-[10px] text-editorial-text font-bold uppercase tracking-wider font-mono block"
                            >
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                                className="w-full text-sm bg-editorial-bg border border-editorial-text/20 focus:border-editorial-text focus:outline-none rounded-none px-3 py-2.5 transition-colors font-sans text-editorial-text"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="password"
                                className="text-[10px] text-editorial-text font-bold uppercase tracking-wider font-mono block"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                autoComplete="new-password"
                                required
                                className="w-full text-sm bg-editorial-bg border border-editorial-text/20 focus:border-editorial-text focus:outline-none rounded-none px-3 py-2.5 transition-colors font-sans text-editorial-text"
                            />
                            <p className="text-[9px] text-editorial-text/50 font-mono">
                                Must be 8–128 characters
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="confirmPassword"
                                className="text-[10px] text-editorial-text font-bold uppercase tracking-wider font-mono block"
                            >
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter your password"
                                autoComplete="new-password"
                                required
                                className="w-full text-sm bg-editorial-bg border border-editorial-text/20 focus:border-editorial-text focus:outline-none rounded-none px-3 py-2.5 transition-colors font-sans text-editorial-text"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-editorial-text text-editorial-bg hover:bg-editorial-accent hover:text-editorial-text border border-editorial-text rounded-none px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-mono transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="text-center pt-2 border-t border-editorial-text/10">
                        <p className="text-xs text-editorial-text/60 font-sans">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="text-editorial-text font-semibold hover:underline"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
