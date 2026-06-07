import React, { useState } from "react";
import { X, Scale, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
  const unusedProducts = allProducts.filter((p) => !products.some((curr) => curr.id === p.id));

  const handleGenerateAIReport = async () => {
    if (!productA || !productB) return;
    setLoading(true);
    setError(null);
    setAiReport(null);

    try {
      const res = await fetch("/api/product-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productA, productB })
      });

      const data = await res.json();
      if (res.ok && data.report) {
        setAiReport(data.report);
      } else {
        throw new Error(data.error || "Failed to generate comparative report");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Khong the tao bao cao so sanh luc nay.");
    } finally {
      setLoading(false);
    }
  };

  const ProductPanel = ({ product }: { product: Product }) => (
    <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[22px] bg-slate-100">
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-editorial-text/45">{product.category}</p>
            <h3 className="mt-1 text-xl font-bold text-editorial-dark line-clamp-1">{product.name}</h3>
            <p className="mt-1 text-sm text-editorial-text/58 line-clamp-2">{product.features[0]}</p>
            <p className="mt-3 text-2xl font-bold text-editorial-dark">${product.price}</p>
          </div>
        </div>
        <button onClick={() => onRemove(product)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-editorial-text/60 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
          Xoa
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-editorial-text/55">Danh gia</span>
          <span className="font-semibold text-editorial-dark">{product.rating} / 5 ({product.reviewsCount})</span>
        </div>
        {product.specs.slice(0, 4).map((spec, idx) => (
          <div key={idx} className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-editorial-text/55">{spec.label}</span>
            <span className="max-w-[60%] text-right font-semibold text-editorial-dark">{spec.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px] border border-white/70 bg-editorial-bg shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-editorial-dark">So sanh san pham</h2>
              <p className="text-sm text-editorial-text/55">Dat 2 san pham canh nhau va nhan phan tich tu AI</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-editorial-text transition hover:bg-editorial-dark hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-8 space-y-6">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <Scale className="h-8 w-8 text-editorial-text/28" />
              </div>
              <h3 className="serif mt-6 text-2xl font-bold text-editorial-dark">Chua co san pham de so sanh</h3>
              <p className="mt-2 max-w-sm text-sm leading-7 text-editorial-text/60">Chon san pham o homepage, bam nut so sanh va quay lai day de xem canh nhau.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {productA && <ProductPanel product={productA} />}
                {productB ? (
                  <ProductPanel product={productB} />
                ) : (
                  <div className="flex flex-col justify-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-editorial-text/45">
                      <Scale className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-editorial-dark">Them san pham thu hai</h3>
                    <p className="mt-2 text-sm leading-6 text-editorial-text/60">Chon nhanh mot san pham khac de AI co du du lieu so sanh.</p>
                    {unusedProducts.length > 0 && (
                      <select
                        onChange={(e) => {
                          const found = allProducts.find((p) => p.id === e.target.value);
                          if (found) onSelectProduct(found);
                        }}
                        defaultValue=""
                        className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                      >
                        <option value="" disabled>Chon san pham</option>
                        {unusedProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {productA && productB && (
                <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7 space-y-5">
                  <div className="flex flex-col gap-4 rounded-[26px] bg-gradient-to-r from-slate-950 via-blue-700 to-violet-600 p-[1px]">
                    <div className="flex flex-col justify-between gap-4 rounded-[25px] bg-white/96 p-5 md:flex-row md:items-center">
                      <div>
                        <div className="flex items-center gap-2 text-blue-700">
                          <Sparkles className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Bao cao AI</p>
                        </div>
                        <h3 className="mt-2 text-xl font-bold text-editorial-dark">Phan tich diem manh, diem yeu va tinh huong phu hop</h3>
                        <p className="mt-2 text-sm leading-7 text-editorial-text/60">AI se tong hop tren gia, thong so va ngữ canh su dung de ho tro demo shopping assistant.</p>
                      </div>
                      <button onClick={handleGenerateAIReport} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl bg-editorial-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Tao bao cao AI
                      </button>
                    </div>
                  </div>

                  {loading && (
                    <div className="rounded-[24px] bg-slate-50 p-8 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                      <p className="mt-3 text-sm text-editorial-text/58">AI dang tong hop bang so sanh va goi y lua chon...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  {aiReport && (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                      <div className="mb-4 flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <p className="text-sm font-semibold">Bao cao da san sang</p>
                      </div>
                      <div className="text-sm leading-7 text-editorial-text/74">
                        <MarkdownRenderer content={aiReport} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
