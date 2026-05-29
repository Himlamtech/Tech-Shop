import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient, ApiError } from '@frontend/src/lib/api-client';
import {
    Loader2,
    AlertCircle,
    ArrowLeft,
    Package,
    Truck,
    CheckCircle2,
    Clock,
    CreditCard,
    XCircle,
    RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    product_image_url: string;
    unit_price: number;
    quantity: number;
    line_total: number;
}

interface OrderStatusHistoryEntry {
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
}

interface OrderDetail {
    id: string;
    user_id: string;
    status: string;
    subtotal: number;
    shipping_fee: number;
    discount_amount: number;
    total_amount: number;
    shipping_address: string;
    items: OrderItem[];
    status_history: OrderStatusHistoryEntry[];
    created_at: string;
    updated_at: string;
}

interface ShipmentStatusHistoryEntry {
    id: string;
    from_status: string;
    to_status: string;
    created_at: string;
}

interface ShipmentDetail {
    id: string;
    order_id: string;
    tracking_code: string;
    status: string;
    shipping_address: string;
    created_at: string;
    updated_at: string;
    status_history: ShipmentStatusHistoryEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
    'created',
    'payment_pending',
    'paid',
    'shipping',
    'completed',
] as const;

const STATUS_LABELS: Record<string, string> = {
    created: 'Order Created',
    payment_pending: 'Payment Pending',
    paid: 'Payment Confirmed',
    shipping: 'Shipping',
    completed: 'Delivered',
    payment_failed: 'Payment Failed',
    cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    created: <Package className="w-5 h-5" />,
    payment_pending: <Clock className="w-5 h-5" />,
    paid: <CreditCard className="w-5 h-5" />,
    shipping: <Truck className="w-5 h-5" />,
    completed: <CheckCircle2 className="w-5 h-5" />,
    payment_failed: <XCircle className="w-5 h-5" />,
    cancelled: <XCircle className="w-5 h-5" />,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchOrderData(id);
        }
    }, [id]);

    async function fetchOrderData(orderId: string) {
        setLoading(true);
        setError(null);
        try {
            const orderData = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
            setOrder(orderData);

            // Try to fetch shipment data (may not exist yet)
            try {
                const shipmentData = await apiClient.get<ShipmentDetail>(
                    `/shipping/shipments/order/${orderId}`
                );
                setShipment(shipmentData);
            } catch {
                // Shipment may not exist yet, that's fine
                setShipment(null);
            }
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('Failed to load order details. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    // ─── Loading State ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8 px-4">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header skeleton */}
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                        <div className="h-8 w-64 bg-gray-200 rounded" />
                    </div>

                    {/* Timeline skeleton */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
                        <div className="h-5 w-40 bg-gray-200 rounded mb-6" />
                        <div className="space-y-6">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                                    <div className="flex-grow space-y-2">
                                        <div className="h-4 w-32 bg-gray-200 rounded" />
                                        <div className="h-3 w-24 bg-gray-200 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Items skeleton */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
                        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                                    <div className="flex-grow space-y-2">
                                        <div className="h-4 w-48 bg-gray-200 rounded" />
                                        <div className="h-3 w-24 bg-gray-200 rounded" />
                                    </div>
                                    <div className="h-4 w-16 bg-gray-200 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Error State ───────────────────────────────────────────────────────────

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center space-y-4 max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <h2 className="text-lg font-semibold text-gray-900">Order Not Found</h2>
                    <p className="text-sm text-gray-600">
                        {error || 'The order you are looking for does not exist or you do not have permission to view it.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => id && fetchOrderData(id)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </button>
                        <Link
                            to="/products"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Shop
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const currentStatusIndex = ORDER_STATUSES.indexOf(
        order.status as (typeof ORDER_STATUSES)[number]
    );

    // For cancelled/payment_failed, find the last valid status reached
    const isCancelled = order.status === 'cancelled';
    const isPaymentFailed = order.status === 'payment_failed';
    const isTerminalError = isCancelled || isPaymentFailed;

    function getStatusTimestamp(status: string): string | null {
        const entry = order!.status_history.find((h) => h.to_status === status);
        return entry ? entry.created_at : null;
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatCurrency(amount: number): string {
        return `$${Number(amount).toFixed(2)}`;
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <Link
                        to="/products"
                        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            Order Tracking
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                                Order ID
                            </span>
                            <span className="text-sm font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {order.id.slice(0, 8)}...
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status Timeline */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-600" />
                        Order Status
                    </h2>

                    {/* Terminal error banner */}
                    {isTerminalError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-800">
                                    {isCancelled ? 'Order Cancelled' : 'Payment Failed'}
                                </p>
                                <p className="text-sm text-red-600 mt-1">
                                    {isCancelled
                                        ? 'This order has been cancelled.'
                                        : 'Payment could not be processed. Please try again or contact support.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Vertical stepper timeline */}
                    <div className="relative">
                        {ORDER_STATUSES.map((status, index) => {
                            const isActive = !isTerminalError && currentStatusIndex >= index;
                            const isCurrent = !isTerminalError && order.status === status;
                            const timestamp = getStatusTimestamp(status);

                            return (
                                <div key={status} className="relative flex items-start gap-4 pb-8 last:pb-0">
                                    {/* Vertical line connector */}
                                    {index < ORDER_STATUSES.length - 1 && (
                                        <div
                                            className={`absolute left-5 top-10 w-0.5 h-[calc(100%-2.5rem)] ${isActive && currentStatusIndex > index
                                                    ? 'bg-green-500'
                                                    : 'bg-gray-200'
                                                }`}
                                        />
                                    )}

                                    {/* Status circle */}
                                    <div
                                        className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all ${isCurrent
                                                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                                : isActive
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-100 text-gray-400'
                                            }`}
                                    >
                                        {isActive && !isCurrent ? (
                                            <CheckCircle2 className="w-5 h-5" />
                                        ) : (
                                            STATUS_ICONS[status]
                                        )}
                                    </div>

                                    {/* Status info */}
                                    <div className="flex-grow pt-1.5">
                                        <p
                                            className={`text-sm font-medium ${isCurrent
                                                    ? 'text-blue-700'
                                                    : isActive
                                                        ? 'text-gray-900'
                                                        : 'text-gray-400'
                                                }`}
                                        >
                                            {STATUS_LABELS[status]}
                                        </p>
                                        {timestamp && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {formatDate(timestamp)}
                                            </p>
                                        )}
                                        {isCurrent && (
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                                                Current
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Shipping Details */}
                {shipment && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-gray-600" />
                            Shipping Details
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
                                    Tracking Code
                                </p>
                                <p className="text-sm font-mono font-bold text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 inline-block">
                                    {shipment.tracking_code}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
                                    Shipment Status
                                </p>
                                <p className="text-sm font-medium text-gray-900 capitalize">
                                    {shipment.status}
                                </p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
                                    Shipping Address
                                </p>
                                <p className="text-sm text-gray-700">
                                    {shipment.shipping_address}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Items */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-600" />
                        Items Purchased
                    </h2>
                    <div className="divide-y divide-gray-100">
                        {order.items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                            >
                                {/* Product image */}
                                <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50">
                                    {item.product_image_url ? (
                                        <img
                                            src={item.product_image_url}
                                            alt={item.product_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-6 h-6 text-gray-300" />
                                        </div>
                                    )}
                                </div>

                                {/* Product info */}
                                <div className="flex-grow min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {item.product_name}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        SKU: {item.product_sku}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                                    </p>
                                </div>

                                {/* Line total */}
                                <p className="text-sm font-semibold text-gray-900 shrink-0">
                                    {formatCurrency(item.line_total)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-600" />
                        Payment Summary
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium text-gray-900">
                                {formatCurrency(order.subtotal)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Shipping Fee</span>
                            <span className="font-medium text-gray-900">
                                {Number(order.shipping_fee) === 0
                                    ? 'FREE'
                                    : formatCurrency(order.shipping_fee)}
                            </span>
                        </div>
                        {Number(order.discount_amount) > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Discount</span>
                                <span className="font-medium text-green-600">
                                    -{formatCurrency(order.discount_amount)}
                                </span>
                            </div>
                        )}
                        <div className="border-t border-gray-200 pt-3 mt-3">
                            <div className="flex justify-between text-base font-bold">
                                <span className="text-gray-900">Total</span>
                                <span className="text-gray-900">
                                    {formatCurrency(order.total_amount)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order metadata */}
                <div className="text-center text-xs text-gray-400 pb-4">
                    <p>
                        Order placed on {formatDate(order.created_at)} · Last updated{' '}
                        {formatDate(order.updated_at)}
                    </p>
                </div>
            </div>
        </div>
    );
}
