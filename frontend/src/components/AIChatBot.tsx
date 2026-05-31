import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, Loader2, ArrowDownCircle, HelpCircle } from "lucide-react";
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
    text: "Welcome to the specimen advisory bureau. I am fully authorized with specs, metrics, and cognitive hardware logs.\n\n*   Compare component ergonomics and mechanical friction\n*   Inquire about display HUD specs or wrist fatigue mitigation\n*   Examine speculative intelligence reports on wearables\n\nWhich component parameters shall we catalog today?",
    timestamp: new Date()
  }
];

export default function AIChatBot({ products, selectedProductId }: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(STARTER_CHAT);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
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
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            sender: m.sender,
            text: m.text
          })),
          selectedProductId
        })
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-ai-${Date.now()}`,
            sender: "ai",
            text: data.text,
            timestamp: new Date()
          }
        ]);
      } else {
        throw new Error(data.error || "Failed to contact chat server");
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ **Sound connection issue**: Or your Gemini API Secret key is missing. ${err.message || ""}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const QUICK_QUESTIONS = [
    { label: "Suggest the best keyboard", text: "What is the best mechanical keyboard in your inventory, and what switches does it use?" },
    { label: "Recommend wearable AR", text: "Are there any wearable AR glasses on stock? Detail their features and HUD layout." },
    { label: "Rugged durability choice", text: "Which product in your watch catalog offers high physical durability and long battery life?" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      
      {/* Expanded Widget Frame */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[400px] h-[550px] bg-editorial-bg border border-editorial-text/25 rounded-2xl flex flex-col shadow-2xl overflow-hidden mb-4 animate-in slide-in-from-bottom-6 duration-200">
          
          {/* Header */}
          <div className="bg-editorial-text p-4 text-editorial-bg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-editorial-bg/10 border border-editorial-bg/25 flex items-center justify-center relative">
                <Sparkles className="w-4.5 h-4.5 text-editorial-bg" />
              </div>
              <div>
                <h3 className="serif text-sm font-bold leading-none">Specimen Advice Bureau</h3>
                <p className="text-[9px] uppercase tracking-wider font-mono text-editorial-bg/75 mt-1">Primed with active catalog logs</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 text-editorial-bg/85 hover:text-editorial-bg rounded-full hover:bg-editorial-bg/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Flow Area */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 max-w-[85%] ${m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                {m.sender === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-editorial-paper border border-editorial-text/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-editorial-text/75" />
                  </div>
                )}

                <div className="space-y-1">
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed text-left shadow-none font-sans ${
                      m.sender === "user"
                        ? "bg-editorial-text text-editorial-bg text-right"
                        : "bg-editorial-paper border border-editorial-text/10 text-editorial-text"
                    }`}
                  >
                    <MarkdownRenderer content={m.text} />
                  </div>
                  <p className="text-[9px] text-editorial-text/40 text-left font-mono">
                    {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto items-center">
                <div className="w-6 h-6 rounded-full bg-editorial-paper border border-editorial-text/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-editorial-text/60 animate-spin" />
                </div>
                <div className="bg-editorial-paper border border-editorial-text/10 text-editorial-text/50 text-[10px] py-1.5 px-3 rounded-xl font-sans italic flex items-center gap-1.5 animate-pulse shadow-none">
                  <Loader2 className="w-3 h-3 text-editorial-text/40 animate-spin" />
                  <span>Advisory composing advice...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts Area */}
          <div className="bg-editorial-paper border-t border-editorial-text/15 p-3 space-y-1.5 shrink-0">
            <p className="text-[9px] text-editorial-text/50 font-bold uppercase tracking-wider font-mono">Quick consultations:</p>
            <div className="flex flex-col gap-1">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.text)}
                  disabled={loading}
                  className="text-left text-[10px] text-editorial-text hover:bg-editorial-accent bg-transparent border border-editorial-text/15 py-1.5 px-3 rounded-full w-full truncate transition-all duration-150 cursor-pointer disabled:opacity-50 font-sans"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Input Message */}
          <form onSubmit={handleFormSubmit} className="bg-editorial-paper p-3 border-t border-editorial-text/15 flex gap-2 shrink-0 font-sans">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              placeholder="Ask advisory for specs..."
              className="flex-grow bg-editorial-bg border border-editorial-text/15 hover:border-editorial-text/30 focus:border-editorial-text focus:outline-none rounded-xl px-4 py-2.5 text-xs text-editorial-text transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="bg-editorial-text text-editorial-bg rounded-lg h-9 w-9 flex items-center justify-center hover:bg-editorial-text/90 disabled:opacity-30 cursor-pointer transition-all duration-300"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
            </button>
          </form>

        </div>
      )}

      {/* Glow Bubble Circle Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-editorial-text hover:bg-editorial-text/95 text-editorial-bg border border-editorial-text shadow-xl transition-all duration-350 cursor-pointer z-50 hover:scale-[1.03]"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5 hover:scale-105 duration-200" />
        )}

        {/* Counter Badge if unread are available and closed */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center bg-editorial-text text-editorial-bg text-[9px] font-bold font-mono rounded-full border border-editorial-bg shadow-sm">
            {unreadCount}
          </span>
        )}

      </button>

    </div>
  );
}
