import React, { useState, useRef, useEffect } from "react";
import { X, Star, Sparkles, Send, HelpCircle, Check, Loader2, Heart, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { Product } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface ProductDetailsProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
}

export default function ProductDetails({ product, onClose, onAddToCart, isFavorite, onToggleFavorite }: ProductDetailsProps) {
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            tag: product.tag,
            description: product.description,
            features: product.features,
            specs: product.specs
          },
          question: query
        })
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setQaHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].a = data.answer;
          return updated;
        });
      } else {
        throw new Error(data.error || "Failed to contact Gemini");
      }
    } catch (err: any) {
      console.error(err);
      setQaHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].a = `Co loi khi tu van AI. ${err.message || "Vui long thu lai sau."}`;
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskAI(question);
  };

  const suggestions = [
    { label: "Co dang tien khong?", query: `Danh gia that long xem ${product.name} co dang tien khong va hop voi nhom nguoi dung nao.` },
    { label: "Nen mua cho viec gi?", query: `Neu dung ${product.name} cho cong viec va hoc tap, diem manh chinh la gi?` },
    { label: "Tinh nang hay bi bo qua", query: `Chi ra 1-2 tinh nang cua ${product.name} ma nguoi dung de bo qua nhat.` }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/55 p-0 md:p-4 backdrop-blur-sm">
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden border-l border-white/50 bg-editorial-bg shadow-[0_30px_80px_rgba(15,23,42,0.22)] md:h-[95vh] md:rounded-[32px] md:border md:border-white/70">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-editorial-text/70">Chi tiet san pham</span>
            <span className="hidden text-[11px] text-editorial-text/45 md:inline">Ma san pham: {product.id}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-editorial-text transition hover:bg-editorial-dark hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[30px] border border-white/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-100 via-white to-sky-50 pt-[78%]">
                  <img src={product.image} alt={product.name} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: ShieldCheck, title: "Bao hanh", text: "Ho tro kiem tra va doi tra de demo storefront." },
                  { icon: Truck, title: "Giao nhanh", text: "Mo phong van chuyen va giao nhan ro rang hon." },
                  { icon: RotateCcw, title: "De so sanh", text: "Co the luu, so sanh va hoi AI truc tiep." }
                ].map((item) => (
                  <div key={item.title} className="rounded-[24px] border border-slate-100 bg-white/90 p-4 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-editorial-dark">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-editorial-text/60">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h3 className="text-sm font-bold text-editorial-dark">Thong so noi bat</h3>
                <div className="mt-4 space-y-3">
                  {product.specs.map((spec, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-editorial-text/55">{spec.label}</span>
                      <span className="max-w-[60%] text-right font-semibold text-editorial-dark">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">{product.category}</span>
                  <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{product.rating}</span>
                    <span className="text-editorial-text/45">({product.reviewsCount} danh gia)</span>
                  </div>
                </div>

                <h1 className="serif mt-4 text-3xl font-extrabold tracking-tight text-editorial-dark md:text-4xl">{product.name}</h1>
                <p className="mt-3 text-sm leading-7 text-editorial-text/65">{product.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {product.features.map((feature, idx) => (
                    <span key={idx} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-editorial-text/70">
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-[26px] bg-gradient-to-r from-slate-950 via-blue-700 to-violet-600 p-[1px] shadow-lg shadow-blue-200/60">
                  <div className="rounded-[25px] bg-white/96 px-5 py-5">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Sparkles className="h-4 w-4" />
                      <p className="text-xs font-semibold uppercase tracking-[0.2em]">AI tom tat</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-editorial-text/70">{product.aiOverview}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4 rounded-[26px] bg-slate-50 px-5 py-4">
                  <div>
                    <p className="text-sm text-editorial-text/45">Gia hien tai</p>
                    <p className="serif text-3xl font-extrabold tracking-tight text-editorial-dark">${product.price}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleFavorite(product)}
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                        isFavorite
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-slate-200 bg-white text-editorial-text hover:border-rose-200 hover:bg-rose-50"
                      }`}
                    >
                      <Heart className={`h-5 w-5 ${isFavorite ? "fill-white" : ""}`} />
                    </button>
                    <button
                      onClick={() => onAddToCart(product)}
                      className="rounded-2xl bg-editorial-dark px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-blue-600"
                    >
                      Them vao gio hang
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-editorial-dark">Hoi AI ve san pham nay</h3>
                      <p className="text-sm text-editorial-text/55">Dat cau hoi theo nhu cau su dung, gia tri, doi tuong phu hop.</p>
                    </div>
                  </div>
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => handleAskAI(suggestion.query)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-editorial-text/75 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>

                {qaHistory.length > 0 && (
                  <div className="mt-5 max-h-[280px] space-y-4 overflow-y-auto pr-2">
                    {qaHistory.map((qa, index) => (
                      <div key={index} className="space-y-2">
                        <div className="ml-auto max-w-[85%] rounded-[22px] bg-editorial-dark px-4 py-3 text-sm text-white shadow-sm">
                          {qa.q}
                        </div>
                        <div className="max-w-[92%] rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-editorial-text/75">
                          {qa.a === "" ? (
                            <div className="flex items-center gap-2 text-editorial-text/50">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>AI dang phan tich va tong hop cau tra loi...</span>
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

                <form onSubmit={handleFormSubmit} className="relative mt-5">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={loading}
                    placeholder={`Hoi them ve ${product.name}...`}
                    className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 pr-14 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || loading}
                    className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-editorial-dark text-white transition hover:bg-blue-600 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-editorial-dark">Danh gia khach hang</h3>
                  <p className="text-sm text-editorial-text/45">Nhan xet gan day</p>
                </div>
                <div className="mt-5 space-y-4">
                  {product.reviews.map((review) => (
                    <div key={review.id} className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-editorial-dark">{review.author}</p>
                          <p className="text-xs text-editorial-text/45">{review.date}</p>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star key={value} className={`h-4 w-4 ${value <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-editorial-text/68">{review.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
