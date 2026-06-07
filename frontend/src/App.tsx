import React, { useState, useEffect } from "react";
import { authenticate, authorizedFetch, fetchCurrentUser, loadStoredSession, logoutSession, persistSession, refreshSession } from "./auth";
import { PRODUCTS } from "./products";
import { AuthSession, Product, CartItem } from "./types";
import Navbar from "./components/Navbar";
import AuthDialog from "./components/AuthDialog";
import ProductCard from "./components/ProductCard";
import ProductDetails from "./components/ProductDetails";
import ComparisonModal from "./components/ComparisonModal";
import AIChatBot from "./components/AIChatBot";
import Cart from "./components/Cart";
import Favorites from "./components/Favorites";
import {
  Search,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Truck,
  Headphones,
  ChevronRight,
  Star,
  Layers3
} from "lucide-react";

const categoryVisuals: Record<string, { blurb: string; gradient: string }> = {
  All: {
    blurb: "Tong hop cac dong san pham duoc quan tam nhieu nhat tu AI goi y va xu huong mua sam.",
    gradient: "from-blue-500 to-violet-500"
  },
  Wearables: {
    blurb: "Dong ho, AR va thiet bi deo thong minh cho cong viec va suc khoe hang ngay.",
    gradient: "from-sky-500 to-cyan-400"
  },
  Audio: {
    blurb: "Tai nghe va am thanh chat luong cao cho lam viec, di chuyen va giai tri.",
    gradient: "from-violet-500 to-fuchsia-500"
  },
  Peripherals: {
    blurb: "Ban phim, trackpad va phu kien giup setup gon gang va thoai mai hon.",
    gradient: "from-amber-400 to-orange-500"
  },
  "Home Tech": {
    blurb: "Cong nghe cho khong gian song hien dai, trinh chieu va trai nghiem tai nha.",
    gradient: "from-emerald-400 to-teal-500"
  }
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [comparedProducts, setComparedProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [aiSearchPrompt, setAiSearchPrompt] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authHydrating, setAuthHydrating] = useState(true);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem("aether_cart");
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      const storedFav = localStorage.getItem("aether_favorites");
      if (storedFav) {
        setFavorites(JSON.parse(storedFav));
      }
    } catch (e) {
      console.error("Local storage sync bypassed:", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      const storedSession = loadStoredSession();
      if (!storedSession) {
        if (!cancelled) {
          setAuthHydrating(false);
        }
        return;
      }

      try {
        let user;

        try {
          user = await fetchCurrentUser(storedSession.accessToken);
        } catch {
          const refreshedSession = await refreshSession(storedSession.refreshToken);
          persistSession(refreshedSession);
          if (!cancelled) {
            setAuthSession(refreshedSession);
          }
          user = await fetchCurrentUser(refreshedSession.accessToken);
          storedSession.accessToken = refreshedSession.accessToken;
          storedSession.refreshToken = refreshedSession.refreshToken;
        }

        if (cancelled) {
          return;
        }

        const nextSession = { ...storedSession, user };
        persistSession(nextSession);
        setAuthSession(nextSession);
      } catch {
        if (!cancelled) {
          persistSession(null);
          setAuthSession(null);
        }
      } finally {
        if (!cancelled) {
          setAuthHydrating(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSession = (session: AuthSession | null) => {
    setAuthSession(session);
  };

  const openAuthDialog = (mode: "login" | "register" = "login") => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthDialogOpen(true);
  };

  const handleAuthSubmit = async (values: { email: string; password: string }) => {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const session = await authenticate(authMode, values);
      persistSession(session);
      setAuthSession(session);
      setAuthDialogOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Khong the xac thuc tai khoan.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!authSession) {
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    try {
      await logoutSession(authSession.refreshToken);
    } catch (error) {
      console.warn("Logout API failed, clearing local session anyway.", error);
    } finally {
      persistSession(null);
      setAuthSession(null);
      setAuthBusy(false);
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem("aether_cart", JSON.stringify(newCart));
    } catch (e) {
      console.warn("Local storage capacity limit:", e);
    }
  };

  const handleAddToCart = (product: Product) => {
    const existingIdx = cart.findIndex((item) => item.product.id === product.id);
    let updatedCart: CartItem[] = [];

    if (existingIdx > -1) {
      updatedCart = [...cart];
      updatedCart[existingIdx].quantity += 1;
    } else {
      updatedCart = [...cart, { product, quantity: 1 }];
    }

    saveCart(updatedCart);
    setCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.product.id === productId) {
          return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);
    saveCart(updated);
  };

  const handleRemoveItem = (productId: string) => {
    const updated = cart.filter((item) => item.product.id !== productId);
    saveCart(updated);
  };

  const handleClearCart = () => {
    saveCart([]);
  };

  const saveFavorites = (newFavorites: Product[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem("aether_favorites", JSON.stringify(newFavorites));
    } catch (e) {
      console.warn("Local storage favorites limit:", e);
    }
  };

  const handleToggleFavorite = (product: Product) => {
    const exists = favorites.some((p) => p.id === product.id);
    const updated = exists ? favorites.filter((p) => p.id !== product.id) : [...favorites, product];
    saveFavorites(updated);
  };

  const handleToggleCompare = (product: Product) => {
    setComparedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 2) {
        return [prev[1], product];
      }
      return [...prev, product];
    });
    setComparisonOpen(true);
  };

  const handleRemoveCompare = (product: Product) => {
    setComparedProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleAISemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = aiSearchPrompt.trim();
    if (!prompt) return;

    setAiSearching(true);
    setAiSearchError(null);

    try {
      const res = await authorizedFetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              sender: "user",
              text: `Search query: "${prompt}". Match this description to exactly ONE corresponding ID of the stock items listed in catalog. Reply ONLY with the matched product ID lowercase among: ar-spectacles, anc-headphones, titanium-smartwatch, mech-keyboard, smart-projector, ergonomic-trackpad. If absolutely none matches, reply with 'none'. Do not say anything else.`
            }
          ]
        })
      }, authSession, updateSession);

      const data = await res.json();
      if (res.ok && data.text) {
        const cleanedId = data.text.trim().toLowerCase();
        const matched = PRODUCTS.find((p) => cleanedId.includes(p.id) || p.id.includes(cleanedId));
        if (matched) {
          setSelectedProduct(matched);
          setAiSearchPrompt("");
        } else {
          setAiSearchError("AI chua tim duoc san pham phu hop nhat. Thu mo ta lai theo nhu cau su dung hoac muc gia.");
        }
      } else {
        throw new Error(data.error || "Failed to parse index recommendation");
      }
    } catch (err: any) {
      console.error(err);

      const lowerPrompt = prompt.toLowerCase();
      let fallbackProduct: Product | null = null;

      if (lowerPrompt.includes("ar") || lowerPrompt.includes("glass") || lowerPrompt.includes("wearable") || lowerPrompt.includes("lens") || lowerPrompt.includes("translate")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "ar-spectacles") || null;
      } else if (lowerPrompt.includes("headphone") || lowerPrompt.includes("anc") || lowerPrompt.includes("audio") || lowerPrompt.includes("noise") || lowerPrompt.includes("sound")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "anc-headphones") || null;
      } else if (lowerPrompt.includes("watch") || lowerPrompt.includes("chrono") || lowerPrompt.includes("gps") || lowerPrompt.includes("health") || lowerPrompt.includes("pulse")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "titanium-smartwatch") || null;
      } else if (lowerPrompt.includes("key") || lowerPrompt.includes("board") || lowerPrompt.includes("mech") || lowerPrompt.includes("type")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "mech-keyboard") || null;
      } else if (lowerPrompt.includes("projector") || lowerPrompt.includes("beam") || lowerPrompt.includes("wall") || lowerPrompt.includes("laser")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "smart-projector") || null;
      } else if (lowerPrompt.includes("touch") || lowerPrompt.includes("trackpad") || lowerPrompt.includes("wrist") || lowerPrompt.includes("ergonomic")) {
        fallbackProduct = PRODUCTS.find((p) => p.id === "ergonomic-trackpad") || null;
      }

      if (fallbackProduct) {
        setSelectedProduct(fallbackProduct);
        setAiSearchPrompt("");
      } else {
        setAiSearchError("Khong tim thay san pham phu hop. Thu cac mo ta ngan gon hon nhu 'headphones for work' hoac 'ergonomic keyboard'.");
      }
    } finally {
      setAiSearching(false);
    }
  };

  const filteredProducts = PRODUCTS.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const query = searchQuery.toLowerCase();
    const matchesKeyword =
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);

    return matchesCategory && matchesKeyword;
  });

  const categories = ["All", "Wearables", "Audio", "Peripherals", "Home Tech"];
  const featuredProducts = PRODUCTS.slice(0, 3);
  const trendingProducts = PRODUCTS.slice(3, 6);
  const activeCategoryInfo = categoryVisuals[activeCategory];

  return (
    <div className="min-h-screen bg-transparent pb-16 text-editorial-text selection:bg-blue-600 selection:text-white">
      <div className="border-t border-white/40" />

      <Navbar
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onCartClick={() => setCartOpen(true)}
        comparedCount={comparedProducts.length}
        onCompareClick={() => setComparisonOpen(true)}
        onAICompanionClick={() => {
          window.dispatchEvent(new CustomEvent("techshop:open-ai-chat"));
        }}
        favoritesCount={favorites.length}
        onFavoritesClick={() => setFavoritesOpen(true)}
        authUser={authSession?.user || null}
        authBusy={authBusy}
        onAuthClick={() => openAuthDialog("login")}
        onLogoutClick={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-14 space-y-10 md:space-y-14">
        <section className="rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(37,99,235,0.88),rgba(124,58,237,0.78))] px-6 py-8 md:px-10 md:py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur">
                <Sparkles className="w-4 h-4" />
                AI shopping assistant dang san sang tu van 24/7
              </div>

              <div className="space-y-4 max-w-3xl">
                <h1 className="serif text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight">
                  Frontend mem mai hon, hien dai hon, va de chon san pham hon.
                </h1>
                <p className="max-w-2xl text-sm md:text-base leading-7 text-white/78">
                  TechShop duoc sap lai theo luong mua sam ro rang: mo dau bang hero noi bat, tiep theo la nganh hang de chon nhanh, san pham noi bat de chuyen doi tot hon va khu AI goi y de demo tinh nang thong minh.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveCategory("All")}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-editorial-dark shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5"
                >
                  Kham pha ngay
                </button>
                <button
                  onClick={() => {
                    if (!authSession) {
                      openAuthDialog("login");
                      return;
                    }
                    window.dispatchEvent(new CustomEvent("techshop:open-ai-chat"));
                  }}
                  className="rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/16"
                >
                  {authSession ? "Hoi AI Assistant" : "Dang nhap de luu phien"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-white/12 bg-white/10 p-4 text-sm backdrop-blur">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">Trang thai tai khoan</p>
                  <p className="mt-1 font-semibold text-white">
                    {authHydrating ? "Dang kiem tra session..." : authSession ? authSession.user.email : "Chua dang nhap"}
                  </p>
                  <p className="mt-1 text-white/68">
                    {authHydrating
                      ? "Frontend dang xac nhan token hien tai voi identity-service."
                      : authSession
                        ? `Role hien tai: ${authSession.user.role}. Ban co the dang xuat bat ky luc nao ngay tren navbar.`
                        : "Dang nhap customer de mua hang, hoac dang nhap admin/staff de test RBAC va dashboard sau nay."}
                  </p>
                </div>
                {!authHydrating && !authSession && (
                  <button
                    onClick={() => openAuthDialog("login")}
                    className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-editorial-dark transition hover:-translate-y-0.5"
                  >
                    Mo dang nhap
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-extrabold">6+</p>
                  <p className="mt-1 text-sm text-white/72">dong san pham cong nghe cho demo</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-extrabold">24/7</p>
                  <p className="mt-1 text-sm text-white/72">tu van AI va tim theo nhu cau</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-extrabold">2 buoc</p>
                  <p className="mt-1 text-sm text-white/72">chon nhanh theo nganh hang va san pham noi bat</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {featuredProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`flex items-center gap-4 rounded-[28px] border border-white/12 bg-white/${index === 0 ? "16" : "10"} p-4 text-left backdrop-blur transition hover:-translate-y-1 hover:bg-white/20`}
                >
                  <img src={product.image} alt={product.name} className="h-20 w-20 rounded-2xl object-cover shadow-lg" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/55">{product.category}</p>
                    <p className="mt-1 serif text-lg font-bold line-clamp-1">{product.name}</p>
                    <p className="mt-1 text-sm text-white/68 line-clamp-2">{product.features[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-blue-700">Nganh hang noi bat</p>
                <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">Chon nhanh theo nhu cau</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs text-editorial-text/60">
                <Layers3 className="w-3.5 h-3.5" />
                Sap xep de nhin hon tren desktop va mobile
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {categories.filter((cat) => cat !== "All").map((cat) => {
                const item = categoryVisuals[cat];
                const count = PRODUCTS.filter((product) => product.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="group rounded-[28px] border border-slate-100 bg-slate-50/80 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-lg font-bold text-white shadow-md`}>
                      {cat.slice(0, 1)}
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-editorial-dark">{cat}</h3>
                    <p className="mt-2 text-sm leading-6 text-editorial-text/62">{item.blurb}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-blue-700">
                      <span>{count} san pham</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-violet-700">AI tim san pham</p>
                <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">Mo ta nhu cau, AI goi y</h2>
              </div>
            </div>

            <form onSubmit={handleAISemanticSearch} className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-4 h-4 w-4 text-editorial-text/35" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tim nhanh theo ten, mo ta, nganh hang..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  required
                  value={aiSearchPrompt}
                  onChange={(e) => setAiSearchPrompt(e.target.value)}
                  disabled={aiSearching}
                  placeholder="Vi du: can tai nghe chong on de hop online"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-blue-300"
                />
                <button
                  type="submit"
                  disabled={!aiSearchPrompt.trim() || aiSearching}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-editorial-dark px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40"
                >
                  {aiSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Tim voi AI
                </button>
              </div>
            </form>

            {aiSearchError && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{aiSearchError}</p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Laptop go nhe de lam viec va hoc AI", "Thiet bi deo theo doi suc khoe", "Phu kien setup ergonomic cho van phong", "May chieu gon cho phong khach"].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setAiSearchPrompt(prompt)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-editorial-text/72 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-blue-700">San pham noi bat</p>
              <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">Bo cuc moi uu tien san pham hot va bo loc de chon nhanh</h2>
              <p className="mt-3 text-sm leading-6 text-editorial-text/65">Khu nay vua co tab theo nganh hang, vua co mo ta ngan de nguoi dung hieu nhanh minh dang xem nhom nao.</p>
            </div>
            <div className={`rounded-[24px] bg-gradient-to-br ${activeCategoryInfo.gradient} p-[1px] shadow-lg shadow-blue-100`}>
              <div className="rounded-[23px] bg-white/95 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-editorial-text/45">Dang xem</p>
                <p className="mt-1 text-lg font-bold text-editorial-dark">{activeCategory}</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-editorial-text/62">{activeCategoryInfo.blurb}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-editorial-dark text-white shadow-lg shadow-slate-900/10"
                      : "border border-slate-200 bg-white text-editorial-text/65 hover:border-blue-200 hover:text-blue-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-sm text-editorial-text/50">{filteredProducts.length} san pham phu hop voi bo loc hien tai</p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-14 text-center">
              <Search className="mx-auto h-8 w-8 text-editorial-text/28" />
              <h3 className="mt-4 serif text-2xl font-bold text-editorial-dark">Khong tim thay san pham phu hop</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-editorial-text/60">Thu bo bot tu khoa tim kiem hoac quay lai tab tat ca de xem toan bo danh muc.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All");
                }}
                className="mt-5 rounded-full bg-editorial-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Dat lai bo loc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={setSelectedProduct}
                  onAddToCart={handleAddToCart}
                  isCompared={comparedProducts.some((p) => p.id === product.id)}
                  onToggleCompare={handleToggleCompare}
                  isFavorite={favorites.some((p) => p.id === product.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
            <p className="text-sm font-semibold text-amber-600">Xu huong mua sam</p>
            <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">San pham dang duoc xem nhieu</h2>
            <div className="mt-6 space-y-4">
              {trendingProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="flex w-full items-center gap-4 rounded-[26px] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-editorial-dark text-sm font-bold text-white">
                    0{index + 1}
                  </div>
                  <img src={product.image} alt={product.name} className="h-20 w-20 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-editorial-text/45">{product.category}</p>
                    <p className="mt-1 text-base font-bold text-editorial-dark line-clamp-1">{product.name}</p>
                    <p className="mt-1 text-sm text-editorial-text/60 line-clamp-1">{product.aiOverview}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-editorial-text/35" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
            <p className="text-sm font-semibold text-emerald-600">Vi sao giao dien nay de demo hon</p>
            <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">Tin cay, mem mai, va co du diem nhan mua sam</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "The hien do tin cay",
                  text: "Card bo tron hon, bong do nhe va block trust ro hon giup giao dien premium ma van de dung."
                },
                {
                  icon: Truck,
                  title: "Day du luong chuyen doi",
                  text: "Da co hero, nganh hang, san pham noi bat va khu xu huong de nguoi dung khong bi lac trong layout."
                },
                {
                  icon: Headphones,
                  title: "AI gan voi shopping",
                  text: "Khu AI duoc dat ngay canh tim kiem va goi y prompt mau de cam giac nhu tro ly mua sam that."
                },
                {
                  icon: Star,
                  title: "Phu hop report/demo",
                  text: "Trang chu nhin day dan hon va co nhieu section de chup man hinh, thuyet trinh va map voi service sau nay."
                }
              ].map((item) => (
                <div key={item.title} className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-md">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-editorial-dark">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-editorial-text/62">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {cartOpen && (
        <Cart
          items={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClose={() => setCartOpen(false)}
          onClearCart={handleClearCart}
        />
      )}

      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          isFavorite={favorites.some((p) => p.id === selectedProduct.id)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {favoritesOpen && (
        <Favorites
          items={favorites}
          onRemoveFavorite={handleToggleFavorite}
          onAddToCart={(p) => {
            handleAddToCart(p);
          }}
          onClose={() => setFavoritesOpen(false)}
        />
      )}

      {comparisonOpen && (
        <ComparisonModal
          products={comparedProducts}
          onRemove={handleRemoveCompare}
          onClose={() => setComparisonOpen(false)}
          allProducts={PRODUCTS}
          onSelectProduct={(p) => {
            setComparedProducts((prev) => [...prev, p]);
          }}
        />
      )}

      <AIChatBot products={PRODUCTS} selectedProductId={selectedProduct?.id} />

      <AuthDialog
        open={authDialogOpen}
        mode={authMode}
        busy={authBusy}
        error={authError}
        onClose={() => {
          if (!authBusy) {
            setAuthDialogOpen(false);
          }
        }}
        onSubmit={handleAuthSubmit}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
        }}
      />

      <footer className="mx-auto mt-16 max-w-5xl space-y-2 border-t border-white/70 py-8 text-center text-[11px] text-editorial-text/45">
        <div>TechShop frontend da duoc lam mem layout voi khu nganh hang, san pham noi bat va AI goi y.</div>
        <div className="text-[10px] opacity-70">2026 TechShop demo storefront for e-commerce and AI shopping assistant</div>
      </footer>
    </div>
  );
}
