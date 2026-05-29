import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '@frontend/src/lib/api-client';
import { useAuth } from '@frontend/src/contexts/AuthContext';
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    CreditCard,
    Banknote,
    Truck,
    ShoppingBag,
    RefreshCw,
} from 'lucide-react';

interface CartItemResponse {
    product_id: string;
    product_name: string;
    product_thumbnail: string;
    unit_price: number;
    quantity: number;
    line_total: number;
}

interface CartResponse {
    items: CartItemResponse[];
    subtotal: number;
}

interface CheckoutResponse {
    order_id: string;
    status: string;
    total_amount: number;
}

type PaymentMethod = 'cod' | 'bank_transfer' | 'credit_card';

interface ShippingAddress {
    full_name: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    zip_code: string;
    phone: string;
}

type CheckoutStatus = 'form' | 'submitting' | 'success' | 'error';

export default function CheckoutPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [cart, setCart] = useState<CartResponse | null>(null);
    const [cartLoading, setCartLoading] = useState(true);
    const [cartError, setCartError] = useState<string | null>(null);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
        full_name: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
    });

    const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>('form');
    const [orderResult, setOrderResult] = useState<CheckoutResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Fetch cart on mount
    useEffect(() => {
        fetchCart();
    }, []);

    async function fetchCart() {
        setCartLoading(true);
        setCartError(null);
        try {
            const data = await apiClient.get<CartResponse>('/cart');
            setCart(data);
        } catch (err) {
            if (err instanceof ApiError) {
                setCartError(err.message);
            } else {
                setCartError('Failed to load cart. Please try again.');
            }
        } finally {
            setCartLoading(false);
        }
    }

    function formatShippingAddress(): string {
        const parts = [
            shippingAddress.full_name,
            shippingAddress.address_line_1,
            shippingAddress.address_line_2,
            shippingAddress.city,
            shippingAddress.state,
            shippingAddress.zip_code,
            shippingAddress.phone,
        ].filter(Boolean);
        return parts.join(', ');
    }

    function isFormValid(): boolean {
        return (
            shippingAddress.full_name.trim() !== '' &&
            shippingAddress.address_line_1.trim() !== '' &&
            shippingAddress.city.trim() !== '' &&
            shippingAddress.state.trim() !== '' &&
            shippingAddress.zip_code.trim() !== '' &&
            shippingAddress.phone.trim() !== '' &&
            cart !== null &&
            cart.items.length > 0
        );
    }

    async function handleSubmitOrder(e: React.FormEvent) {
        e.preventDefault();
        if (!isFormValid()) return;

        setCheckoutStatus('submitting');
        setErrorMessage('');

        try {
            const response = await apiClient.post<CheckoutResponse>('/orders/checkout', {
                shipping_address: formatShippingAddress(),
                payment_method: paymentMethod,
            });
            setOrderResult(response);
            setCheckoutStatus('success');
        } catch (err) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('An unexpected error occurred. Please try again.');
            }
            setCheckoutStatus('error');
        }
    }

    function handleRetry() {
        setCheckoutStatus('form');
        setErrorMessage('');
    }

    function handleInputChange(field: keyof ShippingAddress, value: string) {
        setShippingAddress((prev) => ({ ...prev, [field]: value }));
    }

    const shippingFee = cart && cart.subtotal > 500 ? 0 : 25;
    const totalAmount = cart ? cart.subtotal + shippingFee : 0;

    // Loading state for cart
    if (cartLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto" />
                    <p className="text-sm text-gray-600">Loading your cart...</p>
                </div>
            </div>
        );
    }

    // Cart error state
    if (cartError) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center space-y-4 max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <h2 className="text-lg font-semibold text-gray-900">Unable to load cart</h2>
                    <p className="text-sm text-gray-600">{cartError}</p>
                    <button
                        onClick={fetchCart}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Empty cart state
    if (!cart || cart.items.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center space-y-4 max-w-md">
                    <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto" />
                    <h2 className="text-lg font-semibold text-gray-900">Your cart is empty</h2>
                    <p className="text-sm text-gray-600">Add some items to your cart before checking out.</p>
                    <Link
                        to="/products"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Browse Products
                    </Link>
                </div>
            </div>
        );
    }

    // Success state
    if (checkoutStatus === 'success' && orderResult) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center space-y-6 max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-gray-900">Order Placed Successfully!</h2>
                        <p className="text-sm text-gray-600">
                            Your order has been confirmed and is being processed.
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Order ID</p>
                        <p className="text-lg font-mono font-bold text-gray-900">{orderResult.order_id}</p>
                        <p className="text-sm text-gray-600">
                            Status: <span className="font-medium capitalize">{orderResult.status.replace('_', ' ')}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                            Total: <span className="font-bold">${orderResult.total_amount.toFixed(2)}</span>
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to={`/orders/${orderResult.order_id}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Truck className="w-4 h-4" />
                            Track Order
                        </Link>
                        <Link
                            to="/products"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        to="/products"
                        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shopping
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Checkout</h1>
                </div>

                {/* Error banner */}
                {checkoutStatus === 'error' && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-red-800">Order submission failed</p>
                            <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                        </div>
                        <button
                            onClick={handleRetry}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors shrink-0"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmitOrder}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left column: Shipping + Payment */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Shipping Address */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-gray-600" />
                                    Shipping Address
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingAddress.full_name}
                                            onChange={(e) => handleInputChange('full_name', e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Address Line 1 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingAddress.address_line_1}
                                            onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                                            placeholder="123 Main Street"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Address Line 2
                                        </label>
                                        <input
                                            type="text"
                                            value={shippingAddress.address_line_2}
                                            onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                                            placeholder="Apt 4B (optional)"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            City <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingAddress.city}
                                            onChange={(e) => handleInputChange('city', e.target.value)}
                                            placeholder="New York"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            State <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingAddress.state}
                                            onChange={(e) => handleInputChange('state', e.target.value)}
                                            placeholder="NY"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Zip Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingAddress.zip_code}
                                            onChange={(e) => handleInputChange('zip_code', e.target.value)}
                                            placeholder="10001"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phone <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={shippingAddress.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            placeholder="+1 (555) 123-4567"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-gray-600" />
                                    Payment Method
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <PaymentOption
                                        id="cod"
                                        label="Cash on Delivery"
                                        description="Pay when you receive"
                                        icon={<Banknote className="w-5 h-5" />}
                                        selected={paymentMethod === 'cod'}
                                        onSelect={() => setPaymentMethod('cod')}
                                    />
                                    <PaymentOption
                                        id="bank_transfer"
                                        label="Bank Transfer"
                                        description="Direct bank payment"
                                        icon={<CreditCard className="w-5 h-5" />}
                                        selected={paymentMethod === 'bank_transfer'}
                                        onSelect={() => setPaymentMethod('bank_transfer')}
                                    />
                                    <PaymentOption
                                        id="credit_card"
                                        label="Credit Card"
                                        description="Visa, Mastercard"
                                        icon={<CreditCard className="w-5 h-5" />}
                                        selected={paymentMethod === 'credit_card'}
                                        onSelect={() => setPaymentMethod('credit_card')}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3">
                                    All payment methods are simulated for demonstration purposes.
                                </p>
                            </div>
                        </div>

                        {/* Right column: Order Summary */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm sticky top-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <ShoppingBag className="w-5 h-5 text-gray-600" />
                                    Order Summary
                                </h2>

                                {/* Cart items */}
                                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                                    {cart.items.map((item) => (
                                        <div key={item.product_id} className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50">
                                                {item.product_thumbnail && (
                                                    <img
                                                        src={item.product_thumbnail}
                                                        alt={item.product_name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {item.product_name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Qty: {item.quantity} × ${item.unit_price.toFixed(2)}
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-900 shrink-0">
                                                ${item.line_total.toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div className="border-t border-gray-200 pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-medium text-gray-900">${cart.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping</span>
                                        <span className="font-medium text-gray-900">
                                            {shippingFee === 0 ? 'FREE' : `$${shippingFee.toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
                                        <span className="text-gray-900">Total</span>
                                        <span className="text-gray-900">${totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Submit button */}
                                <button
                                    type="submit"
                                    disabled={!isFormValid() || checkoutStatus === 'submitting'}
                                    className="w-full mt-6 py-3 px-4 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {checkoutStatus === 'submitting' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Place Order
                                        </>
                                    )}
                                </button>

                                {shippingFee === 0 && (
                                    <p className="text-xs text-green-600 text-center mt-2">
                                        🎉 You qualify for free shipping!
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Payment option sub-component
function PaymentOption({
    id,
    label,
    description,
    icon,
    selected,
    onSelect,
}: {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`p-4 rounded-lg border-2 text-left transition-all ${selected
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
        >
            <div className={`mb-2 ${selected ? 'text-gray-900' : 'text-gray-500'}`}>{icon}</div>
            <p className={`text-sm font-medium ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                {label}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </button>
    );
}
