import React, { useState } from "react";
import { X, Scale, Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Product } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface ComparisonModalProps {
  products: Product[];
  onRemove: (product: Product) => void;
  onClose: () => void;
  allProducts: Product[];
  onSelectProduct: (product: Product) => void;
}

export default function ComparisonModal({
  products,
  onRemove,
  onClose,
  allProducts,
  onSelectProduct
}: ComparisonModalProps) {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grab the first two compared products
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
        headers: {
          "Content-Type": "application/json",
        },
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

  // Find other items to compare if we haven't reached limits
  const unusedProducts = allProducts.filter((p) => !products.some((curr) => curr.id === p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      {/* Click outside dismisses modal */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Main Container */}
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl bg-editorial-bg border border-editorial-text/25 flex flex-col shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-editorial-paper px-6 py-4 border-b border-editorial-text/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-editorial-bg border border-editorial-text/15 text-editorial-text">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="serif text-base font-bold text-editorial-text">Comparison Board</h2>
              <p className="text-[9px] uppercase tracking-wider font-mono text-editorial-text/60">Side-by-side electronic analysis & AI Synthesis</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-editorial-text/15 text-editorial-text/60 hover:bg-editorial-text hover:text-editorial-bg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-grow overflow-y-auto p-5 md:p-8 space-y-8">
          
          {products.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Scale className="w-10 h-10 text-editorial-text/30 mx-auto" />
              <div className="space-y-1">
                <p className="serif text-base font-bold text-editorial-text">Board is Empty</p>
                <p className="text-xs text-editorial-text/60 font-sans max-w-sm mx-auto">Add devices on the main homepage to compare specs side by side.</p>
              </div>
              <button
                onClick={onClose}
                className="text-[10px] uppercase font-bold tracking-widest bg-editorial-text text-editorial-bg rounded-full px-6 py-2.5 transition-colors cursor-pointer"
              >
                Go Back Shop
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Product cards side-by-side comparison matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column Product 1 */}
                <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-5 relative overflow-hidden">
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={() => onRemove(productA)}
                      className="text-[9px] uppercase font-mono font-bold bg-editorial-paper text-editorial-text/60 hover:text-red-550 hover:border-red-650 border border-editorial-text/15 px-2.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border border-editorial-text/10 overflow-hidden shrink-0">
                      <img src={productA.image} alt={productA.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-editorial-text/60 uppercase font-mono tracking-wider">{productA.category}</span>
                      <h3 className="serif text-base font-bold text-editorial-text leading-tight">{productA.name}</h3>
                      <p className="text-base font-bold text-editorial-text font-mono mt-0.5">${productA.price}</p>
                    </div>
                  </div>

                  {/* Quick specs snippet */}
                  <div className="mt-5 space-y-2 divide-y divide-editorial-text/10 text-xs text-editorial-text font-sans">
                    <div className="flex justify-between py-1.5 pt-0">
                      <span className="opacity-60">Status Rating</span>
                      <span className="font-semibold">★ {productA.rating} ({productA.reviewsCount})</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-60">Core Attribute</span>
                      <span className="font-semibold text-right max-w-[65%] truncate">{productA.features[0]}</span>
                    </div>
                    {productA.specs.slice(0, 3).map((spec, sIdx) => (
                      <div key={sIdx} className="flex justify-between py-1.5">
                        <span className="opacity-60">{spec.label}</span>
                        <span className="font-semibold text-right max-w-[65%] truncate font-mono text-[11px]">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>                {/* Column Product 2 */}
                {productB ? (
                  <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-5 relative overflow-hidden animate-in slide-in-from-right-10 duration-200">
                    <div className="absolute top-4 right-4 z-10">
                      <button
                        onClick={() => onRemove(productB)}
                        className="text-[9px] uppercase font-mono font-bold bg-editorial-paper text-editorial-text/60 hover:text-red-550 hover:border-red-650 border border-editorial-text/15 px-2.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg border border-editorial-text/10 overflow-hidden shrink-0">
                        <img src={productB.image} alt={productB.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-editorial-text/60 uppercase font-mono tracking-wider">{productB.category}</span>
                        <h3 className="serif text-base font-bold text-editorial-text leading-tight">{productB.name}</h3>
                        <p className="text-base font-bold text-editorial-text font-mono mt-0.5">${productB.price}</p>
                      </div>
                    </div>

                    {/* Quick specs snippet */}
                    <div className="mt-5 space-y-2 divide-y divide-editorial-text/10 text-xs text-editorial-text font-sans">
                      <div className="flex justify-between py-1.5 pt-0">
                        <span className="opacity-60">Status Rating</span>
                        <span className="font-semibold">★ {productB.rating} ({productB.reviewsCount})</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="opacity-60">Core Attribute</span>
                        <span className="font-semibold text-right max-w-[65%] truncate">{productB.features[0]}</span>
                      </div>
                      {productB.specs.slice(0, 3).map((spec, sIdx) => (
                        <div key={sIdx} className="flex justify-between py-1.5">
                          <span className="opacity-60">{spec.label}</span>
                          <span className="font-semibold text-right max-w-[65%] truncate font-mono text-[11px]">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-editorial-text/20 bg-editorial-accent/30 rounded-2xl flex flex-col justify-center items-center p-6 text-center space-y-3">
                    <Scale className="w-6 h-6 text-editorial-text/45" />
                    <div className="space-y-1">
                      <p className="serif text-xs font-bold text-editorial-text">Aligning Companion Unit</p>
                      <p className="text-[10px] text-editorial-text/60 max-w-[200px] leading-relaxed mx-auto font-sans">Select a second product on the homepage catalog to run smart generative comparisons.</p>
                    </div>

                    {unusedProducts.length > 0 && (
                      <div className="w-full max-w-[240px] pt-1">
                        <select
                          onChange={(e) => {
                            const found = allProducts.find((p) => p.id === e.target.value);
                            if (found) onSelectProduct(found);
                          }}
                          defaultValue=""
                          className="w-full bg-editorial-paper text-xs border border-editorial-text/15 hover:border-editorial-text/30 focus:border-editorial-text focus:outline-none rounded-xl p-2 font-mono text-editorial-text"
                        >
                          <option value="" disabled>-- Quick Add Product --</option>
                          {unusedProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* AI Generative report card */}
              {productA && productB && (
                <div className="bg-editorial-paper rounded-2xl border border-editorial-text/15 p-6 space-y-6">
                  
                  {/* Trigger banner */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-editorial-accent/30 border border-editorial-text/15 p-5 rounded-xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-editorial-text">
                        <Sparkles className="w-4 h-4 opacity-80" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest font-mono">Generative Comparison Reports</h4>
                      </div>
                      <p className="text-xs text-editorial-text/70 leading-relaxed max-w-[500px] font-sans">
                        Consult speculative model advisories to produce an exhaustive relative evaluation: analyzing budget weight, hardware trade-offs, and target lifestyle synthesis out of the box.
                      </p>
                    </div>

                    <button
                      onClick={handleGenerateAIReport}
                      disabled={loading}
                      className="bg-editorial-text hover:bg-editorial-text/90 text-editorial-bg font-bold text-[10px] px-6 py-3.5 rounded-full flex items-center justify-center gap-2 tracking-widest font-mono uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shrink-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-editorial-bg" />
                          <span>Generating Synthesis...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-editorial-bg" />
                          <span>Generate AI Spec Reports</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Loading micro notes */}
                  {loading && (
                    <div className="py-8 text-center space-y-3 animate-pulse">
                      <Loader2 className="w-6 h-6 text-editorial-text animate-spin mx-auto" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-editorial-text font-mono tracking-widest uppercase">Loading Neural Review</p>
                        <p className="text-[10px] text-editorial-text/50 font-sans italic">"Formulating decision matrix and syncing comparative indices..."</p>
                      </div>
                    </div>
                  )}

                  {/* Error Panel */}
                  {error && (
                    <div className="p-4 bg-red-50/50 border border-red-200/60 text-red-800 rounded-xl flex items-start gap-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold serif text-red-900">Review Generation Suspended</p>
                        <p className="text-red-700 font-sans opacity-95">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Comparative report markdown show */}
                  {aiReport && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 border-b border-editorial-text/15 pb-3">
                        <div className="w-1.5 h-1.5 bg-editorial-text shrink-0" />
                        <h4 className="text-[10px] font-bold text-editorial-text/60 uppercase tracking-widest font-mono">Gemini AI Intelligence Dispatch</h4>
                      </div>
                      <div className="bg-editorial-bg rounded-xl border border-editorial-text/15 p-6 font-sans text-editorial-text">
                        <MarkdownRenderer content={aiReport} />
                      </div>
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
