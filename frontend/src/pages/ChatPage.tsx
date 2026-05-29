import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    Send,
    Sparkles,
    Loader2,
    ChevronLeft,
    AlertCircle,
    MessageSquare,
    ShoppingBag,
    ExternalLink,
} from 'lucide-react';
import { apiClient, ApiError } from '@frontend/src/lib/api-client';
import { useAuth } from '@frontend/src/contexts/AuthContext';

// --- Types ---

interface ProductRecommendation {
    id: string;
    name: string;
    price: number | string;
    image_url?: string;
    reason?: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    products?: ProductRecommendation[];
    timestamp: Date;
    isError?: boolean;
}

interface AIChatResponse {
    answer: string;
    products?: ProductRecommendation[];
    grounded?: boolean;
    hallucination_risk?: string;
    sources?: string[];
}

// --- Suggested Prompts ---

const SUGGESTED_PROMPTS = [
    {
        icon: '💻',
        text: 'Recommend a laptop for AI learning under 20M VND',
    },
    {
        icon: '📸',
        text: 'Compare iPhone and Samsung for photography',
    },
    {
        icon: '🎧',
        text: 'Which headphones are best for online meetings?',
    },
    {
        icon: '⌨️',
        text: 'Best mechanical keyboard for programming?',
    },
    {
        icon: '🖥️',
        text: 'Suggest a monitor for graphic design work',
    },
];

// --- Product Recommendation Card ---

function ProductCard({ product }: { product: ProductRecommendation }) {
    const price =
        typeof product.price === 'string'
            ? parseFloat(product.price)
            : product.price;

    return (
        <Link
            to={`/products/${product.id}`}
            className="flex gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
        >
            {/* Product Image */}
            <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-gray-400" />
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {product.name}
                </h4>
                <p className="text-sm font-bold text-blue-600 mt-0.5">
                    {price > 0
                        ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'Contact for price'}
                </p>
                {product.reason && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {product.reason}
                    </p>
                )}
            </div>

            {/* View link */}
            <div className="flex items-center shrink-0">
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
        </Link>
    );
}

// --- Typing Indicator ---

function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}

// --- Main ChatPage Component ---

export default function ChatPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const productContext = searchParams.get('product') || undefined;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // If product context is provided, auto-send a greeting
    useEffect(() => {
        if (productContext && messages.length === 0) {
            sendMessage(`Tell me more about this product and suggest similar alternatives.`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productContext]);

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Get cart product IDs from localStorage
            let cartProductIds: string[] = [];
            try {
                const storedCart = localStorage.getItem('aether_cart');
                if (storedCart) {
                    const cartItems = JSON.parse(storedCart);
                    cartProductIds = cartItems.map((item: { product: { id: string } }) => item.product.id);
                }
            } catch {
                // ignore localStorage errors
            }

            const response = await apiClient.post<AIChatResponse>('/ai/chat', {
                message: trimmed,
                user_id: user?.id || undefined,
                context: {
                    current_product_id: productContext || undefined,
                    cart_product_ids: cartProductIds.length > 0 ? cartProductIds : undefined,
                },
            });

            const aiMessage: ChatMessage = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: response.answer || 'I received your message but have no specific answer at this time.',
                products: response.products?.slice(0, 5),
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof ApiError
                    ? err.message
                    : 'Sorry, I encountered an error. Please try again.';

            const errorMsg: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date(),
                isError: true,
            };

            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputText);
    };

    const handleSuggestedPrompt = (text: string) => {
        sendMessage(text);
    };

    const showSuggestions = messages.length === 0 && !isLoading;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Go back"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>

                    <div className="flex items-center gap-2.5 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Sparkles className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-gray-900">TechShop AI Assistant</h1>
                            <p className="text-xs text-gray-500">
                                {user ? `Hi ${user.email.split('@')[0]}` : 'Guest mode'} · Product advisor
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/products"
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        Browse Products
                    </Link>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    {/* Welcome / Suggestions */}
                    {showSuggestions && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-8">
                            <div className="text-center space-y-3">
                                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    How can I help you today?
                                </h2>
                                <p className="text-sm text-gray-500 max-w-md">
                                    Ask me about products, get personalized recommendations, or compare tech specs.
                                    {!user && (
                                        <span className="block mt-1 text-xs text-amber-600">
                                            Sign in for personalized recommendations based on your history.
                                        </span>
                                    )}
                                </p>
                            </div>

                            {/* Suggested Prompts */}
                            <div className="w-full max-w-lg space-y-2">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">
                                    Try asking
                                </p>
                                <div className="grid gap-2">
                                    {SUGGESTED_PROMPTS.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSuggestedPrompt(prompt.text)}
                                            className="flex items-center gap-3 w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                                        >
                                            <span className="text-lg">{prompt.icon}</span>
                                            <span className="text-sm text-gray-700 group-hover:text-blue-700 transition-colors">
                                                {prompt.text}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="space-y-6">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''
                                    }`}
                            >
                                {/* Avatar */}
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                )}

                                {/* Message Bubble */}
                                <div
                                    className={`max-w-[80%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'
                                        }`}
                                >
                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                                : msg.isError
                                                    ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
                                                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                                            }`}
                                    >
                                        {msg.isError && (
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                <span className="text-xs font-medium text-red-600">Error</span>
                                            </div>
                                        )}
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>

                                    {/* Product Recommendations */}
                                    {msg.products && msg.products.length > 0 && (
                                        <div className="space-y-2 w-full max-w-sm">
                                            <p className="text-xs font-medium text-gray-500 px-1">
                                                Recommended products:
                                            </p>
                                            {msg.products.map((product) => (
                                                <ProductCard key={product.id} product={product} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Timestamp */}
                                    <p
                                        className={`text-[10px] text-gray-400 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'
                                            }`}
                                    >
                                        {msg.timestamp.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {isLoading && <TypingIndicator />}

                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={isLoading}
                            placeholder="Ask about products, recommendations, comparisons..."
                            className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isLoading}
                            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                            aria-label="Send message"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </form>
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                        AI responses are generated based on our product catalog. Results may vary.
                    </p>
                </div>
            </div>
        </div>
    );
}
