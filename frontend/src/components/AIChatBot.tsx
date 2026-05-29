import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, Loader2, ExternalLink, ShoppingBag, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Product } from "../types";
import { apiClient, ApiError } from "@frontend/src/lib/api-client";

interface AIChatBotProps {
  products: Product[];
  selectedProductId?: string;
}

interface ProductRecommendation {
  id: string;
  name: string;
  price: number | string;
  image_url?: string;
  reason?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
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

const SUGGESTED_PROMPTS = [
  { label: "Laptop for AI learning", text: "Recommend a laptop for AI learning under 20M VND" },
  { label: "Best headphones for meetings", text: "Which headphones are best for online meetings?" },
  { label: "Compare phones for photos", text: "Compare iPhone and Samsung for photography" },
];

function MiniProductCard({ product }: { product: ProductRecommendation }) {
  const price = typeof product.price === "string" ? parseFloat(product.price) : product.price;

  return (
    <Link
      to={`/products/${product.id}`}
      className="flex gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 shrink-0 rounded bg-gray-100 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
          {product.name}
        </p>
        <p className="text-[10px] font-bold text-blue-600">
          {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Contact"}
        </p>
      </div>
      <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-500 shrink-0 mt-1" />
    </Link>
  );
}

export default function AIChatBot({ products, selectedProductId }: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Get cart product IDs from localStorage
      let cartProductIds: string[] = [];
      try {
        const storedCart = localStorage.getItem("aether_cart");
        if (storedCart) {
          const cartItems = JSON.parse(storedCart);
          cartProductIds = cartItems.map((item: { product: { id: string } }) => item.product.id);
        }
      } catch {
        // ignore localStorage errors
      }

      const response = await apiClient.post<AIChatResponse>("/ai/chat", {
        message: trimmed,
        context: {
          current_product_id: selectedProductId || undefined,
          cart_product_ids: cartProductIds.length > 0 ? cartProductIds : undefined,
        },
      });

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.answer || "I received your message but have no specific answer at this time.",
        products: response.products?.slice(0, 5),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "Sorry, I encountered an error. Please try again.";

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);

      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Chat Panel */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[400px] h-[560px] bg-gray-50 border border-gray-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden mb-4 animate-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">TechShop AI</h3>
                <p className="text-[10px] text-white/75 mt-0.5">Product advisor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/chat"
                className="text-[10px] text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title="Open full chat"
              >
                Full page
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 text-white/85 hover:text-white rounded-full hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-grow overflow-y-auto p-3 space-y-3">
            {/* Suggestions for empty state */}
            {showSuggestions && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 py-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-gray-900">How can I help?</p>
                  <p className="text-xs text-gray-500">Ask about products or get recommendations</p>
                </div>
                <div className="w-full space-y-1.5 px-2">
                  {SUGGESTED_PROMPTS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q.text)}
                      disabled={isLoading}
                      className="text-left text-[11px] text-gray-700 hover:text-blue-700 hover:bg-blue-50 bg-white border border-gray-200 py-2 px-3 rounded-lg w-full truncate transition-all cursor-pointer disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 max-w-[88%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : msg.isError
                        ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                      }`}
                  >
                    {msg.isError && (
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-medium text-red-600">Error</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Product Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.products.map((product) => (
                        <MiniProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}

                  <p className="text-[9px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 max-w-[85%] mr-auto items-center">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-white animate-pulse" />
                </div>
                <div className="bg-white border border-gray-200 text-gray-500 text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleFormSubmit} className="bg-white p-3 border-t border-gray-200 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              placeholder="Ask about products..."
              className="flex-grow bg-gray-100 border border-gray-200 focus:border-blue-400 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-900 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-blue-600 text-white rounded-lg h-9 w-9 flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl transition-all duration-300 cursor-pointer z-50 hover:scale-105"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}

        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
