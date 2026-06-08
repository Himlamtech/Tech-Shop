import React, { useEffect, useRef, useState } from "react";
import { X, Star, Sparkles, Send, HelpCircle, Check, Loader2, Heart } from "lucide-react";
import { AuthSession, Product } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";
import { createReview } from "../reviews";

interface ProductDetailsProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  authSession: AuthSession | null;
  onProductRefresh: (productId: string) => Promise<void>;
}

export default function ProductDetails({ product, onClose, onAddToCart, isFavorite, onToggleFavorite, authSession, onProductRefresh }: ProductDetailsProps) {
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaHistory, loading]);

  const handleAskAI = async (textToAsk: string) => {
    const query = textToAsk.trim();
    if (!query) return;

    setLoading(true);
    setQaHistory((prev) => [...prev, { q: query, a: "" }]);
    setQuestion("");

    try {
      const res = await fetch("/api/product-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            tag: product.tag,
            description: product.description,
            features: product.features,
            specs: product.specs,
            rating: product.rating,
            reviewsCount: product.reviewsCount,
          },
          question: query,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.answer) {
        throw new Error(data.error || "Failed to contact Gemini");
      }

      setQaHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].a = data.answer;
        return updated;
      });
    } catch (error: any) {
      setQaHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].a = `Connection error: ${error?.message || "AI request failed."}`;
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authSession || authSession.user.role !== "customer") {
      setReviewError("Sign in with a customer account to submit a review.");
      return;
    }

    setReviewBusy(true);
    setReviewError(null);
    try {
      await createReview({ product_id: product.id, rating: reviewRating, comment: reviewComment.trim() }, authSession, () => undefined);
      setReviewComment("");
      setReviewRating(5);
      await onProductRefresh(product.id);
    } catch (error: any) {
      setReviewError(error?.message || "Review submission failed.");
    } finally {
      setReviewBusy(false);
    }
  };

  const suggestions = [
    { label: "Is it worth the price?", query: "Be extremely honest: is this product worth its price tag, or are there cheaper options that do the same?" },
    { label: "Who is this designed for?", query: "Detail the perfect target audience for this product. What lifestyle or problem does it solve?" },
    { label: "Explain a hidden feature", query: "What is an overlooked or hidden feature of this product that most users don't know about?" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/65 p-0 md:p-4 transition-all duration-300">
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-4xl h-full md:h-[95vh] rounded-none md:rounded-l-3xl bg-editorial-bg border-l border-editorial-text/25 flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
        <div className="bg-editorial-paper px-6 py-4 border-b border-editorial-text/15 flex items-center justify-between shadow-none">
          <div className="flex items-center gap-2 font-sans">
            <span className="text-[10px] font-mono font-bold tracking-widest text-editorial-text bg-editorial-bg border border-editorial-text/15 px-3 py-1 rounded-full uppercase">Catalogue Detail</span>
            <span className="text-[10px] text-editorial-text/60 font-mono">SPECIMEN ID: {product.id}</span>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-full border border-editorial-text/15 text-editorial-text/60 hover:bg-editorial-text hover:text-editorial-bg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-5 md:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6">
              <div className="relative pt-[80%] rounded-2xl bg-white border border-editorial-text/15 overflow-hidden shadow-none">
                <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
              </div>

              <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-5 shadow-none space-y-4">
                <h4 className="text-[10px] font-bold text-editorial-text/75 uppercase tracking-widest font-mono border-b border-editorial-text/15 pb-2">Technical Blueprint</h4>
                <div className="divide-y divide-editorial-text/10 text-xs text-editorial-text">
                  {product.specs.map((spec, idx) => (
                    <div key={idx} className="flex justify-between py-2.5 gap-4">
                      <span className="font-sans opacity-60">{spec.label}</span>
                      <span className="font-mono font-bold text-right">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-5 shadow-none">
                <h4 className="text-[10px] font-bold text-editorial-text/75 uppercase tracking-widest font-mono mb-3">Capabilities Checklist</h4>
                <div className="space-y-2.5 text-editorial-text">
                  {product.features.map((feature, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start text-xs font-sans">
                      <div className="flex items-center justify-center w-4 h-4 bg-editorial-accent text-editorial-text border border-editorial-text/15 rounded-md mt-0.5 shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2 pb-5 border-b border-editorial-text/15">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[9px] font-bold text-editorial-text bg-editorial-bg border border-editorial-text/15 px-3 py-0.5 rounded-full uppercase tracking-wider font-mono">{product.category}</span>
                  <div className="flex items-center gap-1.5 bg-editorial-paper rounded-full px-3.5 py-1 border border-editorial-text/10 text-editorial-text font-sans">
                    <Star className="w-3.5 h-3.5 text-yellow-550 fill-yellow-500 opacity-95" />
                    <span className="text-xs font-bold">{product.rating}</span>
                    <span className="text-[10px] opacity-60">({product.reviewsCount} reviews)</span>
                  </div>
                </div>

                <h2 className="serif text-2xl md:text-3xl font-bold text-editorial-text tracking-tight leading-tight">{product.name}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-editorial-text font-mono">${product.price}</span>
                  <span className="text-xs text-editorial-text/50 font-sans">SKU {product.sku || "n/a"}</span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs md:text-sm text-editorial-text/80 leading-relaxed font-sans">{product.description}</p>
                <div className="bg-editorial-accent/30 border border-editorial-text/15 rounded-2xl p-5 shadow-none space-y-2.5">
                  <div className="flex items-center gap-2 text-editorial-text">
                    <Sparkles className="w-4 h-4 text-editorial-text shrink-0 opacity-80" />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest font-mono">AI Generative Overview</h4>
                  </div>
                  <p className="serif text-[12px] md:text-xs text-editorial-text/80 leading-relaxed italic pl-2 border-l border-editorial-text/30">"{product.aiOverview}"</p>
                </div>
              </div>

              <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-5 md:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-editorial-text/15 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-editorial-text text-editorial-bg shadow-none"><HelpCircle className="w-4 h-4" /></div>
                    <div>
                      <h4 className="text-xs font-bold text-editorial-text uppercase tracking-widest font-mono">Ask Gemini Specialist</h4>
                      <p className="text-[10px] text-editorial-text/60 font-sans uppercase tracking-wider font-semibold">Real-time specifications advisor</p>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-editorial-text shrink-0 opacity-80" />
                </div>

                {qaHistory.length > 0 && (
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 divide-y divide-editorial-text/10">
                    {qaHistory.map((qa, index) => (
                      <div key={index} className="space-y-2 pt-3 first:pt-0">
                        <div className="flex items-start gap-2 justify-end">
                          <div className="bg-editorial-bg text-editorial-text border border-editorial-text/15 text-xs py-1.5 px-3 rounded-xl font-sans font-medium max-w-[85%] text-left">{qa.q}</div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-editorial-text flex items-center justify-center text-editorial-bg text-[9px] font-mono font-bold shrink-0">AI</div>
                          <div className="bg-editorial-bg border border-editorial-text/15 text-editorial-text text-xs py-2 px-3.5 rounded-xl font-sans max-w-[90%] text-left shadow-none">
                            {qa.a === "" ? <div className="flex items-center gap-2 text-[11px] text-editorial-text/50 font-sans italic py-1 animate-pulse"><Loader2 className="w-3.5 h-3.5 text-editorial-text animate-spin" /><span>Consulting Gemini Core...</span></div> : <MarkdownRenderer content={qa.a} />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={responseEndRef} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-[10px] text-editorial-text/45 font-mono uppercase tracking-widest font-bold">Tap a speculative query:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((item, idx) => (
                      <button key={idx} onClick={() => handleAskAI(item.query)} disabled={loading} className="text-[10px] text-editorial-text hover:text-editorial-bg bg-transparent hover:bg-editorial-text border border-editorial-text/15 rounded-full py-1.5 px-3 scroll-smooth cursor-pointer disabled:opacity-50 transition-all duration-150 uppercase tracking-widest font-mono font-bold">{item.label}</button>
                    ))}
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAskAI(question); }} className="flex gap-2 relative">
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={loading} placeholder={`Ask about ${product.name}...`} className="flex-grow text-xs bg-editorial-bg border border-editorial-text/15 focus:border-editorial-text placeholder:text-editorial-text/30 hover:border-editorial-text/45 rounded-xl px-4 py-3 pr-11 focus:outline-none text-editorial-text transition-all duration-150" />
                  <button type="submit" disabled={!question.trim() || loading} className="absolute right-1.5 top-1.5 h-8.5 w-8.5 rounded-lg bg-editorial-text hover:bg-editorial-text/90 text-editorial-bg flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><Send className="w-3.5 h-3.5" /></button>
                </form>
              </div>

              <div className="flex items-center gap-3 bg-editorial-paper p-4 rounded-2xl border border-editorial-text/15 shadow-none">
                <button onClick={() => onAddToCart(product)} className="flex-grow bg-editorial-text hover:bg-editorial-text/90 text-editorial-bg font-bold text-xs py-4 px-6 rounded-xl cursor-pointer duration-200 uppercase tracking-widest font-mono">Configure & Add To Basket</button>
                <button onClick={() => onToggleFavorite(product)} className={`flex items-center justify-center w-12.5 h-12.5 rounded-xl border transition-all duration-200 cursor-pointer ${isFavorite ? "bg-red-500 border-red-500 text-white hover:bg-red-650" : "bg-transparent border-editorial-text/20 text-editorial-text hover:bg-editorial-accent/20 hover:border-editorial-text"}`}>
                  <Heart className={`w-5 h-5 ${isFavorite ? "fill-white" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-6 md:p-8 space-y-6 shadow-none">
            <div className="flex items-baseline justify-between border-b border-editorial-text/15 pb-4">
              <h3 className="text-xs font-bold text-editorial-text uppercase tracking-widest font-mono">Customer Assessment</h3>
              <p className="text-[10px] text-editorial-text/50 font-sans uppercase tracking-wider font-semibold">Continuous verification</p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-3 border border-editorial-text/10 bg-editorial-bg/60 p-4 rounded-2xl">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[10px] uppercase tracking-widest font-mono text-editorial-text/60">Submit verified review</p>
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="border border-editorial-text/15 bg-white px-3 py-2 text-xs">
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                </select>
              </div>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} required minLength={3} placeholder={authSession?.user.role === "customer" ? "Share how the product performed after purchase..." : "Sign in as a customer to submit a verified review."} className="w-full min-h-28 border border-editorial-text/15 bg-white px-4 py-3 text-xs focus:outline-none focus:border-editorial-text" disabled={reviewBusy || authSession?.user.role !== "customer"} />
              {reviewError && <div className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-xs text-red-800">{reviewError}</div>}
              <button type="submit" disabled={reviewBusy || authSession?.user.role !== "customer" || !reviewComment.trim()} className="border border-editorial-text bg-editorial-text px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-bg disabled:opacity-50 disabled:cursor-not-allowed">{reviewBusy ? "Submitting" : "Publish Review"}</button>
            </form>

            <div className="divide-y divide-editorial-text/10">
              {product.reviews.length === 0 ? (
                <p className="py-4 text-xs text-editorial-text/60">No published reviews yet.</p>
              ) : product.reviews.map((review) => (
                <div key={review.id} className="py-4 first:pt-2 last:pb-2 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] font-sans text-editorial-text">
                    <div>
                      <span className="font-bold">{review.author}</span>
                      <span className="text-editorial-text/20 mx-1.5">•</span>
                      <span className="text-editorial-text/60">{review.date}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star key={value} className={`w-3 h-3 ${value <= review.rating ? "text-editorial-text fill-editorial-text opacity-95" : "text-editorial-text/15"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-editorial-text/80 leading-relaxed font-sans">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
