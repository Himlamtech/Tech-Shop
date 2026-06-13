import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Heart, Loader2, MessageSquareText, Send, Star, X } from "lucide-react";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
    { label: "Daily fit", query: `Who should buy ${product.name}, and who should skip it?` },
    { label: "Tradeoffs", query: `What are the main strengths and weaknesses of ${product.name}?` },
    { label: "Setup advice", query: `How would you use ${product.name} in a premium desk setup or travel workflow?` },
  ];

  const highlights = useMemo(() => product.features.slice(0, 4), [product.features]);
  const pros = useMemo(() => product.features.slice(0, 3), [product.features]);
  const cons = useMemo(() => {
    const cues = [
      product.stock !== undefined ? `Availability depends on ${product.stock} units currently in stock.` : null,
      product.price > 300 ? "Premium price point." : "Entry-friendly price point.",
      product.reviewsCount < 5 ? "There are still limited customer reviews to validate long-term usage." : "Specs should still be checked against your exact workflow before purchase.",
    ];
    return cues.filter((item): item is string => Boolean(item)).slice(0, 3);
  }, [product]);
  const useCases = useMemo(() => [
    `${product.category} buyers comparing top options.`,
    `Users who care about ${product.features[0] || "balanced performance"} in day-to-day use.`,
    `Shoppers building a setup around ${product.brand || "trusted"} hardware.`,
  ], [product]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/28 p-0 md:p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <aside className="relative z-10 flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-none border border-stone-900/10 bg-white shadow-[0_30px_100px_rgba(112,82,48,0.45)] md:h-[92vh] md:rounded-[8px]">
        <div className="flex items-center justify-between border-b border-stone-900/10 px-6 py-4 md:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/45">Product detail</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">{product.name}</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/70 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="overflow-y-auto p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
              <div className="space-y-5">
                <div className="overflow-hidden rounded-[8px] border border-stone-900/10 bg-stone-100/70">
                  <img src={product.image} alt={product.name} className="h-[300px] w-full object-cover" />
                </div>

                <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/45">Specifications</p>
                  <div className="mt-4 divide-y divide-stone-900/10 text-sm">
                    {product.specs.map((spec, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-4 py-3">
                        <span className="text-editorial-text/52">{spec.label}</span>
                        <span className="max-w-[55%] text-right font-medium text-editorial-text">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-editorial-text/58">
                  <span className="rounded-full border border-amber-700/20 bg-amber-700/10 px-3 py-1.5 text-amber-900">{product.category}</span>
                  <span className="rounded-full border border-stone-900/10 bg-white/65 px-3 py-1.5">{product.brand || "Lamania"}</span>
                  <span className="rounded-full border border-stone-900/10 bg-white/65 px-3 py-1.5">SKU {product.sku || "n/a"}</span>
                </div>

                <div className="grid gap-4 border-b border-stone-900/10 pb-6 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                  <div className="min-w-0">
                    <h3 className="break-words text-3xl font-semibold leading-tight text-editorial-text md:text-4xl">{product.name}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-editorial-text/66">{product.description}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4 text-left xl:text-right">
                    <p className="break-words text-2xl font-semibold text-editorial-text">{formatCurrency(product.price)}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-sm text-amber-600">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-semibold text-editorial-text">{product.rating.toFixed(1)}</span>
                      <span className="text-editorial-text/45">({product.reviewsCount} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] border border-amber-700/15 bg-amber-700/5 p-5">
                  <div className="flex items-center gap-2 text-amber-900">
                    <Check className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Summary</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-editorial-text/78">{product.aiOverview}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">Pros</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-editorial-text/72">
                      {pros.map((item, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">Considerations</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-editorial-text/68">
                      {cons.map((item, idx) => (
                        <div key={idx}>{item}</div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">Use cases</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-editorial-text/72">
                      {useCases.map((item, idx) => (
                        <div key={idx}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">Feature highlights</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {highlights.map((feature, idx) => (
                      <span key={idx} className="rounded-full border border-stone-900/10 bg-stone-100/65 px-3 py-2 text-sm text-editorial-text/72">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[8px] border border-stone-900/10 bg-white p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-stone-900/10 pb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">Reviews</p>
                      <p className="mt-1 text-sm text-editorial-text/60">Customer feedback.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitReview} className="mt-5 rounded-[24px] border border-stone-900/10 bg-stone-100/65 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-editorial-text">Submit review</p>
                      <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="rounded-xl border border-stone-900/10 bg-stone-100/80 px-3 py-2 text-sm text-editorial-text outline-none">
                        {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                      </select>
                    </div>
                    <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} required minLength={3} placeholder={authSession?.user.role === "customer" ? "Share how the product performed in real use." : "Sign in as a customer to submit a review."} className="mt-4 min-h-28 w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25" disabled={reviewBusy || authSession?.user.role !== "customer"} />
                    {reviewError && <div className="mt-3 rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">{reviewError}</div>}
                    <button type="submit" disabled={reviewBusy || authSession?.user.role !== "customer" || !reviewComment.trim()} className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                      {reviewBusy ? "Submitting" : "Publish review"}
                    </button>
                  </form>

                  <div className="mt-6 divide-y divide-stone-900/10">
                    {product.reviews.length === 0 ? (
                      <p className="py-4 text-sm text-editorial-text/55">No published reviews yet.</p>
                    ) : product.reviews.map((review) => (
                      <div key={review.id} className="py-4 first:pt-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-editorial-text">
                            <span className="font-semibold">{review.author}</span>
                            <span className="mx-2 text-editorial-text/25">•</span>
                            <span className="text-editorial-text/52">{review.date}</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-600">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <Star key={value} className={`h-3.5 w-3.5 ${value <= review.rating ? "fill-current" : "text-white/15"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-editorial-text/68">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-900/10 bg-stone-100/65 xl:border-l xl:border-t-0">
            <div className="flex h-full flex-col overflow-y-auto p-6">
              <div className="rounded-[8px] border border-stone-900/10 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-700/20 bg-amber-700/10 text-amber-900">
                    <MessageSquareText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-editorial-text">Ask about this product</p>
                    <p className="text-xs text-editorial-text/55">Quick answers before checkout.</p>
                  </div>
                </div>

                {qaHistory.length > 0 && (
                  <div className="mt-5 max-h-[340px] space-y-4 overflow-y-auto pr-1">
                    {qaHistory.map((qa, index) => (
                      <div key={index} className="space-y-2">
                        <div className="ml-auto max-w-[90%] rounded-2xl border border-amber-700/20 bg-amber-700/10 px-4 py-3 text-sm text-amber-900">
                          {qa.q}
                        </div>
                        <div className="max-w-[92%] rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm leading-6 text-editorial-text/74">
                          {qa.a === "" ? (
                            <div className="flex items-center gap-2 text-editorial-text/55">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Preparing an answer...
                            </div>
                          ) : (
                            <MarkdownRenderer content={qa.a} />
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={responseEndRef} />
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button key={item.label} onClick={() => handleAskAI(item.query)} disabled={loading} className="rounded-full border border-stone-900/10 bg-white/65 px-3 py-2 text-xs text-editorial-text/64 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text disabled:opacity-50">
                      {item.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAskAI(question); }} className="mt-5 flex gap-2">
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={loading} placeholder={`Ask about ${product.name}`} className="flex-1 rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25" />
                  <button type="submit" disabled={!question.trim() || loading} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#a8783f,#b98746)] text-stone-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div className="mt-5 rounded-[8px] border border-stone-900/10 bg-white p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/45">Buy</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => onAddToCart(product)} className="flex-1 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-100">
                    Add to cart
                  </button>
                  <button onClick={() => onToggleFavorite(product)} className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${isFavorite ? "border-rose-400/25 bg-rose-400/12 text-rose-300" : "border-stone-900/10 bg-white/65 text-editorial-text/74 hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"}`}>
                    <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
