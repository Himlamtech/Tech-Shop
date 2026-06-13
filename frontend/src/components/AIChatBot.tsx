import React, { useEffect, useRef, useState } from "react";
import { HelpCircle, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { Message, Product } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface AIChatBotProps {
  products: Product[];
  selectedProductId?: string;
}

const STARTER_CHAT: Message[] = [
  {
    id: "welcome",
    sender: "ai",
    text: "I can help you narrow the catalog, compare premium hardware, and explain which product best fits a workflow or budget.",
    timestamp: new Date(),
  },
];

export default function AIChatBot({ products, selectedProductId }: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(STARTER_CHAT);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    } else if (messages.length > STARTER_CHAT.length) {
      setUnreadCount((c) => c + 1);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const userMessage: Message = {
      id: `m-usr-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ sender: m.sender, text: m.text })),
          selectedProductId,
          products: products.slice(0, 12).map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            brand: product.brand,
            rating: product.rating,
            reviewsCount: product.reviewsCount,
            tag: product.tag,
            description: product.description,
            features: product.features.slice(0, 4),
            specs: product.specs.slice(0, 4),
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [...prev, { id: `m-ai-${Date.now()}`, sender: "ai", text: data.text, timestamp: new Date() }]);
      } else {
        throw new Error(data.error || "Failed to contact chat server");
      }
    } catch (err: any) {
      console.error(err);
      const top = products.slice(0, 3);
      const fallback = top.length > 0
        ? `Mình chưa gọi được AI server, nhưng vẫn có thể gợi ý nhanh từ catalog hiện tại:\n\n${top.map((p, index) => `${index + 1}. **${p.name}** - ${p.category}, ${p.rating}/5, khoảng $${p.price}. Hợp khi bạn cần ${p.features.slice(0, 2).join(" và ") || "một lựa chọn cân bằng"}.`).join("\n")}\n\nBạn mô tả thêm ngân sách, mục đích dùng chính và sản phẩm đang phân vân, mình sẽ lọc tiếp theo kiểu tư vấn mua thật.`
        : "Mình chưa gọi được AI server và catalog chưa tải xong. Hãy thử lại sau vài giây hoặc hỏi theo nhu cầu, mình sẽ lọc khi dữ liệu sản phẩm sẵn sàng.";
      setMessages((prev) => [...prev, { id: `m-err-${Date.now()}`, sender: "ai", text: fallback, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const QUICK_QUESTIONS = [
    { label: "Best value setup", text: "Which product gives the best premium-to-price ratio right now?" },
    { label: "Creator workflow", text: "Recommend hardware for a clean creator desk setup with premium feel." },
    { label: "Travel-friendly gear", text: "What should I buy if I want compact, premium hardware for commuting or travel?" },
  ];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end md:bottom-6 md:right-6">
      {isOpen && (
        <div className="mb-4 flex h-[min(760px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden rounded-[32px] border border-stone-900/10 bg-[linear-gradient(180deg,rgba(255,250,240,0.98),rgba(248,243,232,0.96))] shadow-[0_30px_100px_rgba(112,82,48,0.75)] backdrop-blur-xl">
          <div className="border-b border-stone-900/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-700/20 bg-amber-700/10 text-amber-900 shadow-[0_0_30px_rgba(185,135,70,0.2)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-editorial-text">AI Advisor</h3>
                  <p className="mt-1 text-xs text-editorial-text/55">Catalog-aware hardware guidance</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/60 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 ${m.sender === "user" ? "bg-[linear-gradient(135deg,rgba(185,135,70,0.95),rgba(185,135,70,0.95))] text-stone-950" : "border border-stone-900/10 bg-white/65 text-editorial-text/74"}`}>
                  <MarkdownRenderer content={m.text} />
                  <p className={`mt-2 text-[10px] ${m.sender === "user" ? "text-slate-800/70" : "text-editorial-text/35"}`}>
                    {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-[22px] border border-stone-900/10 bg-white/65 px-4 py-3 text-sm text-editorial-text/55">
                  AI advisor is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-stone-900/10 bg-stone-100/65 p-4">
            <div className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4">
              <div className="flex items-center gap-2 text-editorial-text/58">
                <HelpCircle className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-[0.18em]">Suggested prompts</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q.label} onClick={() => handleSendMessage(q.text)} disabled={loading} className="rounded-full border border-stone-900/10 bg-white/65 px-3 py-2 text-xs text-editorial-text/64 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text disabled:opacity-50">
                    {q.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-editorial-text/45">Catalog loaded: {products.length} products</p>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 flex gap-2">
              <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={loading} placeholder="Ask the AI advisor about fit, value, or comparisons" className="flex-1 rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25" />
              <button type="submit" disabled={!inputText.trim() || loading} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        id="techshop-ai-launcher"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-700/20 bg-[linear-gradient(135deg,rgba(185,135,70,0.95),rgba(185,135,70,0.95))] text-stone-950 shadow-[0_20px_60px_rgba(185,135,70,0.35)] transition hover:scale-[1.03] hover:brightness-110"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-stone-900/20 bg-white px-1 text-[10px] font-bold text-stone-950">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
