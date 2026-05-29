import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    ChevronLeft,
    Loader2,
    ShoppingBag,
} from 'lucide-react';
import { apiClient } from '@frontend/src/lib/api-client';
import ImageWithFallback from '@frontend/src/components/product/ImageWithFallback';
import ErrorState from '@frontend/src/components/product/ErrorState';

// --- Types ---

interface CartItemData {
    id: string;
    product_id: string;
    name: string;
    thumbnail: string | null;
    unit_price: string;
    quantity: number;
    line_total: string;
}

interface CartData {
    id: string;
    user_id: string;
    items: CartItemData[];
    subtotal: string;
}

// --- Skeleton Loading ---

function CartSkeleton() {
    return (
        <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100">
                    <div className="w-20 h-20 bg-gray-200 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-gray-200 rounded" />
                        <div className="h-4 w-1/4 bg-gray-200 rounded" />
                        <div className="h-8 w-32 bg-gray-200 rounded" />
                    </div>
                    <div className="h-4 w-16 bg-gray-200 rounded self-center" />
                </div>
            ))}
            <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
                <div className="h-4 w-1/3 bg-gray-200 rounded" />
                <div className="h-6 w-1/4 bg-gray-200 rounded" />
                <div className="h-12 w-full bg-gray-200 rounded-lg" />
            </div>
        </div>
    );
}

// --- Empty Cart State ---

function EmptyCartState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                <ShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
                Looks like you haven't added any items to your cart yet. Browse our products to find something you'll love.
            </p>
            <Link
                to="/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
                <ShoppingCart className="w-4 h-4" />
                Browse Products
            </Link>
        </div>
    );
}

// --- Cart Item Row ---

interface CartItemRowProps {
    item: CartItemData;
    onUpdateQuantity: (itemId: string, quantity: number) => void;
    onRemove: (itemId: string) => void;
    updatingId: string | null;
}

function CartItemRow({ item, onUpdateQuantity, onRemove, updatingId }: CartItemRowProps) {
    const unitPrice = parseFloat(item.unit_price);
    const lineTotal = parseFloat(item.line_total);
    const isUpdating = updatingId === item.id;

    return (
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            {/* Product Image */}
            <Link to={`/products/${item.product_id}`} className="shrink-0">
                <ImageWithFallback
                    src={item.thumbnail || ''}
                    alt={item.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg"
                />
            </Link>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <Link
                    to={`/products/${item.product_id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                >
                    {item.name}
                </Link>
                <p className="text-sm text-gray-500 mt-1">
                    ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                </p>

                {/* Quantity Controls */}
                <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isUpdating}
                            className="p-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease quantity"
                        >
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-gray-900">
                            {isUpdating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-gray-400" />
                            ) : (
                                item.quantity
                            )}
                        </span>
                        <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= 99 || isUpdating}
                            className="p-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Increase quantity"
                        >
                            <Plus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                    </div>

                    {/* Remove Button */}
                    <button
                        onClick={() => onRemove(item.id)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors"
                        aria-label={`Remove ${item.name} from cart`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                    </button>
                </div>
            </div>

            {/* Line Total */}
            <div className="sm:text-right shrink-0 self-center">
                <p className="text-sm font-bold text-gray-900">
                    ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        </div>
    );
}

// --- Main Cart Page ---

export default function CartPage() {
    const navigate = useNavigate();

    const [cart, setCart] = useState<CartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchCart = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiClient.get<CartData>('/cart/current');
            setCart(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to load cart');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    const handleUpdateQuantity = async (itemId: string, quantity: number) => {
        if (quantity < 1 || quantity > 99) return;
        setUpdatingId(itemId);
        try {
            const updatedCart = await apiClient.patch<CartData>(`/cart/items/${itemId}`, { quantity });
            setCart(updatedCart);
        } catch (err: any) {
            // Refresh cart on error to get consistent state
            await fetchCart();
        } finally {
            setUpdatingId(null);
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        setUpdatingId(itemId);
        try {
            const updatedCart = await apiClient.delete<CartData>(`/cart/items/${itemId}`);
            setCart(updatedCart);
        } catch (err: any) {
            await fetchCart();
        } finally {
            setUpdatingId(null);
        }
    };

    const handleProceedToCheckout = () => {
        navigate('/checkout');
    };

    // --- Render ---

    const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const subtotal = cart ? parseFloat(cart.subtotal) : 0;
    const isEmpty = !cart || cart.items.length === 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
                {/* Back navigation */}
                <button
                    onClick={() => navigate('/products')}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Continue Shopping
                </button>

                {/* Page Title */}
                <div className="flex items-center gap-3 mb-8">
                    <ShoppingCart className="w-6 h-6 text-gray-900" />
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Shopping Cart</h1>
                    {!loading && !isEmpty && (
                        <span className="text-sm text-gray-500 font-medium">
                            ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                        </span>
                    )}
                </div>

                {/* Loading State */}
                {loading && <CartSkeleton />}

                {/* Error State */}
                {!loading && error && (
                    <ErrorState
                        title="Failed to load cart"
                        message={error}
                        onRetry={fetchCart}
                    />
                )}

                {/* Empty State */}
                {!loading && !error && isEmpty && <EmptyCartState />}

                {/* Cart Content */}
                {!loading && !error && !isEmpty && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Cart Items List */}
                        <div className="lg:col-span-2 space-y-3">
                            {cart!.items.map((item) => {
                                return (
                                    <div key={item.id}>
                                        <CartItemRow
                                            item={item}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onRemove={handleRemoveItem}
                                            updatingId={updatingId}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Order Summary */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sticky top-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

                                <div className="space-y-3 border-b border-gray-100 pb-4 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                            Items ({itemCount})
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                            ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-base font-bold text-gray-900">Subtotal</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <button
                                    onClick={handleProceedToCheckout}
                                    disabled={isEmpty}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    Proceed to Checkout
                                </button>

                                <Link
                                    to="/products"
                                    className="block text-center text-sm text-blue-600 hover:text-blue-700 mt-4 transition-colors"
                                >
                                    Continue Shopping
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
