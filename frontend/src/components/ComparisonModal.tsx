import React, { useState } from "react";
import { AlertCircle, Loader2, Scale, Sparkles, X } from "lucide-react";
import { Product } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface ComparisonModalProps {
  products: Product[];
  onRemove: (product: Product) => void;
  onClose: () => void;
  allProducts: Product[];
  onSelectProduct: (product: Product) => void;
}

export default function ComparisonModal({ products, onRemove, onClose, allProducts, onSelectProduct }: ComparisonModalProps) {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productA = products[0];
  const productB = products[1];

  const handleGenerateAIReport = async () => {
    if (!productA || !productB) return;

    setLoading(true);
    setError(null);
    setAiReport(null);

    try {
      const res = await fetch("/api/product-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productA, productB }),
      });

      const data = await res.json();
      if (res.ok && data.report) {
        setAiReport(data.report);
      } else {
        throw new Error(data.error || "Failed to generate comparative report");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An expected error has occurred while consulting the models.");
    } finally {
      setLoading(false);
    }
  };

  const unusedProducts = allProducts.filter((p) => !products.some((curr) => curr.id === p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,27,0.96),rgba(6,9,20,0.96))] shadow-[0_30px_100px_rgba(2,6,23,0.75)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Comparison board</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">AI-assisted tradeoff view</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/60 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 md:p-8">
          {products.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-16 text-center">
              <Scale className="mx-auto h-10 w-10 text-editorial-text/30" />
              <h3 className="mt-5 text-2xl font-semibold text-editorial-text">No products queued for comparison</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-editorial-text/55">Add up to two products from the grid to compare price, specs, and AI recommendations side by side.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {[productA, productB].map((product, index) => product ? (
                  <div key={product.id} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/40">
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">{product.category}</p>
                          <h3 className="mt-1 text-lg font-semibold text-editorial-text">{product.name}</h3>
                          <p className="mt-2 text-xl font-semibold text-editorial-text">${product.price}</p>
                        </div>
                      </div>
                      <button onClick={() => onRemove(product)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-editorial-text/70 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-200">
                        Remove
                      </button>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                      <div className="space-y-3 text-sm text-editorial-text/68">
                        <div className="flex justify-between gap-3"><span>Rating</span><span className="font-semibold text-editorial-text">{product.rating} / 5</span></div>
                        <div className="flex justify-between gap-3"><span>Reviews</span><span className="font-semibold text-editorial-text">{product.reviewsCount}</span></div>
                        <div className="flex justify-between gap-3"><span>Brand</span><span className="font-semibold text-editorial-text">{product.brand || "TechShop"}</span></div>
                        {product.specs.slice(0, 3).map((spec, idx) => (
                          <div key={idx} className="flex justify-between gap-3"><span>{spec.label}</span><span className="max-w-[55%] text-right font-semibold text-editorial-text">{spec.value}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`placeholder-${index}`} className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
                    <Scale className="mx-auto h-8 w-8 text-editorial-text/30" />
                    <h3 className="mt-4 text-xl font-semibold text-editorial-text">Add a second product</h3>
                    <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-editorial-text/55">Pick another device to unlock side-by-side comparison and AI recommendations.</p>
                    {unusedProducts.length > 0 && (
                      <select onChange={(e) => { const found = allProducts.find((p) => p.id === e.target.value); if (found) onSelectProduct(found); }} defaultValue="" className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-editorial-text outline-none">
                        <option value="" disabled>Select a product</option>
                        {unusedProducts.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {productA && productB && (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-4 rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(76,130,255,0.12),rgba(85,214,255,0.04))] p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-cyan-100">
                        <Sparkles className="h-4 w-4" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">AI comparison summary</p>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-editorial-text/72">Generate a narrative comparison covering value, strengths, tradeoffs, and buyer fit for the current two-product shortlist.</p>
                    </div>
                    <button onClick={handleGenerateAIReport} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate report
                    </button>
                  </div>

                  {loading && (
                    <div className="py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
                      <p className="mt-3 text-sm text-editorial-text/55">Building the comparison narrative...</p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                      <p>{error}</p>
                    </div>
                  )}

                  {aiReport && (
                    <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/45 p-5 text-sm leading-7 text-editorial-text/74">
                      <MarkdownRenderer content={aiReport} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
