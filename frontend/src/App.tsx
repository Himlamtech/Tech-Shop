import React, { useEffect, useMemo, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Filter,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Navbar from "./components/Navbar";
import ProductCard from "./components/ProductCard";
import ProductDetails from "./components/ProductDetails";
import ComparisonModal from "./components/ComparisonModal";
import AIChatBot from "./components/AIChatBot";
import Cart from "./components/Cart";
import Favorites from "./components/Favorites";
import AuthDialog from "./components/AuthDialog";
import AdminPanel from "./components/AdminPanel";
import {
  authenticate,
  authenticateWithGoogle,
  clearFirebaseClientSession,
  completePhoneSignIn,
  loadStoredSession,
  logoutSession,
  persistSession,
  restoreSession,
  startPhoneSignIn,
} from "./auth";
import { deleteAdminReview, fetchAdminDashboard, fetchAdminPayments, fetchAdminReviews, fetchAdminUserDetail, fetchAdminUsers, updateAdminUser } from "./admin";
import { AdminDashboardData, AdminPaymentRecord, AdminReviewRecord, AdminUserRecord, AuthSession, CartItem, CategoryNode, Product } from "./types";
import { fetchCatalogProducts, fetchCategories, fetchProductDetail } from "./catalog";
import { addRemoteCartItem, clearRemoteCart, fetchRemoteCart, removeRemoteCartItem, updateRemoteCartItem } from "./cart";
import { checkoutOrder } from "./orders";

function flattenCategories(categories: CategoryNode[], bag: string[] = []): string[] {
  categories.forEach((category) => {
    bag.push(category.name);
    if (category.children.length > 0) {
      flattenCategories(category.children, bag);
    }
  });
  return bag;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getAiSpotlight(products: Product[]) {
  if (products.length === 0) {
    return [];
  }

  const byRating = [...products].sort((a, b) => (b.rating * 10 + b.reviewsCount) - (a.rating * 10 + a.reviewsCount));
  const byPrice = [...products].sort((a, b) => a.price - b.price);

  return [
    { label: "Top Rated", value: byRating[0]?.name ?? "Syncing", meta: `${byRating[0]?.rating ?? 0}/5 signal` },
    { label: "Best Entry", value: byPrice[0]?.name ?? "Syncing", meta: byPrice[0] ? formatCurrency(byPrice[0].price) : "Catalog loading" },
    { label: "Live Catalog", value: `${products.length}`, meta: "AI-ranked devices" },
  ];
}

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
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<CategoryNode[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardData | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminPayments, setAdminPayments] = useState<AdminPaymentRecord[]>([]);
  const [adminReviews, setAdminReviews] = useState<AdminReviewRecord[]>([]);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [aiSearchPrompt, setAiSearchPrompt] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  const productLookup = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(flattenCategories(categoriesTree)))], [categoriesTree]);
  const isAdminWorkspace = authSession?.user.role === "admin";
  const isCustomerSession = authSession?.user.role === "customer";

  useEffect(() => {
    let cancelled = false;

    try {
      const storedCart = localStorage.getItem("aether_cart");
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      const storedFav = localStorage.getItem("aether_favorites");
      if (storedFav) {
        setFavorites(JSON.parse(storedFav));
      }
    } catch (error) {
      console.error("Local storage sync bypassed:", error);
    }

    const storedSession = loadStoredSession();
    if (storedSession) {
      setAuthSession(storedSession);
      restoreSession(storedSession)
        .then((session) => {
          if (cancelled) return;
          persistSession(session);
          setAuthSession(session);
        })
        .catch(() => {
          if (cancelled) return;
          persistSession(null);
          setAuthSession(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bootstrapCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [catalogProducts, categoryData] = await Promise.all([
          fetchCatalogProducts(),
          fetchCategories(),
        ]);
        setProducts(catalogProducts);
        setCategoriesTree(categoryData);
      } catch (error: any) {
        setCatalogError(error?.message || "Catalog could not be synchronized.");
      } finally {
        setCatalogLoading(false);
      }
    };

    bootstrapCatalog();
  }, []);

  useEffect(() => {
    if (!authSession || authSession.user.role !== "customer" || products.length === 0) {
      return;
    }

    fetchRemoteCart(authSession, setAuthSession, productLookup)
      .then((items) => setCart(items))
      .catch((error) => console.error("Remote cart sync failed:", error));
  }, [authSession?.user.id, authSession?.user.role, products.length]);

  const syncAdminData = async (sessionOverride?: AuthSession | null) => {
    const session = sessionOverride ?? authSession;
    if (!session || session.user.role !== "admin") {
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      const [dashboard, users, payments, reviews] = await Promise.all([
        fetchAdminDashboard(session, setAuthSession),
        fetchAdminUsers(session, setAuthSession),
        fetchAdminPayments(session, setAuthSession),
        fetchAdminReviews(session, setAuthSession),
      ]);
      setAdminDashboard(dashboard);
      setAdminUsers(users);
      setAdminPayments(payments);
      setAdminReviews(reviews);
    } catch (error: any) {
      setAdminError(error?.message || "Admin workspace could not be synchronized.");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminWorkspace) {
      syncAdminData();
    }
  }, [authSession?.user.id, authSession?.user.role]);

  const finalizeAuthSession = async (session: AuthSession) => {
    persistSession(session);
    setAuthSession(session);
    setAuthDialogOpen(false);
    setPhoneConfirmation(null);

    if (session.user.role === "admin") {
      await syncAdminData(session);
    }
    if (session.user.role === "customer" && products.length > 0) {
      const remoteCart = await fetchRemoteCart(session, setAuthSession, productLookup);
      setCart(remoteCart);
    }
  };

  const handleAuthSubmit = async (values: { email: string; password: string }) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await authenticate(authMode, values);
      await finalizeAuthSession(session);
    } catch (error: any) {
      setAuthError(error?.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await authenticateWithGoogle();
      await finalizeAuthSession(session);
    } catch (error: any) {
      setAuthError(error?.message || "Google sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneSendCode = async (phoneNumber: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const confirmation = await startPhoneSignIn(phoneNumber);
      setPhoneConfirmation(confirmation);
    } catch (error: any) {
      setAuthError(error?.message || "Phone verification could not start.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneVerifyCode = async (otpCode: string) => {
    if (!phoneConfirmation) {
      setAuthError("Request a verification code before submitting the OTP.");
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await completePhoneSignIn(phoneConfirmation, otpCode);
      await finalizeAuthSession(session);
    } catch (error: any) {
      setAuthError(error?.message || "OTP verification failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneReset = () => {
    setPhoneConfirmation(null);
    setAuthError(null);
  };

  const handleLogout = async () => {
    if (authSession?.refreshToken) {
      try {
        await logoutSession(authSession.refreshToken);
      } catch {
        // Clear local session even if the service already revoked the token.
      }
    }
    await clearFirebaseClientSession();
    persistSession(null);
    setAuthSession(null);
    setPhoneConfirmation(null);
    setAdminDashboard(null);
    setAdminUsers([]);
    setAdminPayments([]);
    setAdminReviews([]);
  };

  const handleToggleUserStatus = async (user: AdminUserRecord) => {
    if (!authSession) return;
    await updateAdminUser(user.id, { is_active: !user.is_active }, authSession, setAuthSession);
    await syncAdminData();
  };

  const handleClearLockout = async (user: AdminUserRecord) => {
    if (!authSession) return;
    await updateAdminUser(user.id, { clear_lockout: true }, authSession, setAuthSession);
    await syncAdminData();
  };

  const handleChangeUserRole = async (user: AdminUserRecord, role: string) => {
    if (!authSession || role === user.role) return;
    await updateAdminUser(user.id, { role }, authSession, setAuthSession);
    await syncAdminData();
  };

  const handleSelectAdminUser = async (user: AdminUserRecord) => {
    if (!authSession) return;
    setSelectedAdminUserId(user.id);
    const detail = await fetchAdminUserDetail(user.id, authSession, setAuthSession);
    setAdminUsers((current) => current.map((item) => (item.id === detail.id ? detail : item)));
  };

  const handleDeleteReview = async (review: AdminReviewRecord) => {
    if (!authSession) return;
    await deleteAdminReview(review.id, authSession, setAuthSession);
    await syncAdminData();
  };

  const saveLocalCart = (nextCart: CartItem[]) => {
    setCart(nextCart);
    try {
      localStorage.setItem("aether_cart", JSON.stringify(nextCart));
    } catch (error) {
      console.warn("Local storage capacity limit:", error);
    }
  };

  const handleAddToCart = async (product: Product) => {
    if (isCustomerSession && authSession) {
      try {
        const syncedCart = await addRemoteCartItem(product.id, 1, authSession, setAuthSession, productLookup);
        setCart(syncedCart);
        setCartOpen(true);
        return;
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : "Failed to add item to cart.");
      }
    }

    const existingIdx = cart.findIndex((item) => item.product.id === product.id);
    if (existingIdx > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      saveLocalCart(updatedCart);
    } else {
      saveLocalCart([...cart, { product, quantity: 1 }]);
    }
    setCartOpen(true);
  };

  const handleUpdateQuantity = async (item: CartItem, delta: number) => {
    if (isCustomerSession && authSession && item.id) {
      const nextQuantity = Math.max(1, item.quantity + delta);
      const syncedCart = await updateRemoteCartItem(item.id, nextQuantity, authSession, setAuthSession, productLookup);
      setCart(syncedCart);
      return;
    }

    const updated = cart.map((cartItem) => {
      if (cartItem.product.id === item.product.id) {
        return { ...cartItem, quantity: Math.max(1, cartItem.quantity + delta) };
      }
      return cartItem;
    });
    saveLocalCart(updated);
  };

  const handleRemoveItem = async (item: CartItem) => {
    if (isCustomerSession && authSession && item.id) {
      const syncedCart = await removeRemoteCartItem(item.id, authSession, setAuthSession, productLookup);
      setCart(syncedCart);
      return;
    }

    saveLocalCart(cart.filter((cartItem) => cartItem.product.id !== item.product.id));
  };

  const handleClearCart = async () => {
    if (isCustomerSession && authSession) {
      const syncedCart = await clearRemoteCart(authSession, setAuthSession, productLookup);
      setCart(syncedCart);
      return;
    }
    saveLocalCart([]);
  };

  const saveFavorites = (newFavorites: Product[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem("aether_favorites", JSON.stringify(newFavorites));
    } catch (error) {
      console.warn("Local storage favorites limit:", error);
    }
  };

  const handleToggleFavorite = (product: Product) => {
    const exists = favorites.some((p) => p.id === product.id);
    saveFavorites(exists ? favorites.filter((p) => p.id !== product.id) : [...favorites, product]);
  };

  const handleToggleCompare = (product: Product) => {
    setComparedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 2) return [prev[1], product];
      return [...prev, product];
    });
    setComparisonOpen(true);
  };

  const handleRemoveCompare = (product: Product) => {
    setComparedProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleProductSelect = async (product: Product) => {
    try {
      const detail = await fetchProductDetail(product.id);
      setSelectedProduct(detail);
    } catch {
      setSelectedProduct(product);
    }
  };

  const handleProductRefresh = async (productId: string) => {
    const detail = await fetchProductDetail(productId);
    setProducts((current) => current.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)));
    setSelectedProduct(detail);
  };

  const handleCheckout = async (shippingAddress: string) => {
    if (!authSession || authSession.user.role !== "customer") {
      throw new Error("Please sign in with a customer account to complete checkout.");
    }

    const order = await checkoutOrder(shippingAddress, authSession, setAuthSession);
    const emptyCart = await clearRemoteCart(authSession, setAuthSession, productLookup);
    setCart(emptyCart);
    return order;
  };

  const handleAISemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = aiSearchPrompt.trim().toLowerCase();
    if (!prompt) return;

    setAiSearching(true);
    setAiSearchError(null);

    try {
      const matched = products.find((product) => {
        const corpus = [product.name, product.category, product.description, product.brand, ...product.features]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return prompt.split(/\s+/).some((token) => token.length > 2 && corpus.includes(token));
      });

      if (!matched) {
        throw new Error("I couldn't pinpoint a perfect product match for that description.");
      }

      await handleProductSelect(matched);
      setAiSearchPrompt("");
    } catch (error: any) {
      setAiSearchError(error?.message || "Unable to locate a matching product.");
    } finally {
      setAiSearching(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const haystack = [product.name, product.description, product.category, product.brand, ...product.features].join(" ").toLowerCase();
    return matchesCategory && haystack.includes(searchQuery.toLowerCase());
  });

  const heroStats = useMemo(() => getAiSpotlight(products), [products]);
  const heroProduct = filteredProducts[0] ?? products[0] ?? null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-editorial-bg text-editorial-text">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-25" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(85,214,255,0.18),transparent_58%)] blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(125,107,255,0.16),transparent_60%)] blur-3xl" />

      <Navbar
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setCartOpen(true)}
        comparedCount={comparedProducts.length}
        onCompareClick={() => setComparisonOpen(true)}
        onAICompanionClick={() => {
          document.getElementById("techshop-ai-launcher")?.click();
        }}
        favoritesCount={favorites.length}
        onFavoritesClick={() => setFavoritesOpen(true)}
        authSession={authSession}
        onAuthClick={() => {
          setAuthMode("login");
          setAuthError(null);
          setPhoneConfirmation(null);
          setAuthDialogOpen(true);
        }}
        onLogoutClick={handleLogout}
      />

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="glass-panel glass-border overflow-hidden rounded-[32px] p-6 md:p-8"
          >
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-editorial-text/60">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                AI Curated Hardware
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Production-Ready Catalog
              </span>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div>
                <h1 className="serif max-w-3xl text-4xl font-bold leading-[0.95] tracking-[-0.04em] md:text-6xl">
                  Shop future hardware with
                  <span className="text-gradient"> AI-guided confidence.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-editorial-text/68 md:text-base">
                  A premium storefront for curated devices, intelligent search, fast comparison, and checkout that stays connected to your existing catalog and session logic.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {heroStats.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/50">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-editorial-text">{item.value}</p>
                      <p className="mt-1 text-xs text-editorial-text/55">{item.meta}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/52">AI Command Search</p>
                      <p className="mt-1 text-sm text-editorial-text/70">Describe a setup, workflow, or constraint and jump straight to the closest product.</p>
                    </div>
                    <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200 md:block">
                      Natural language enabled
                    </div>
                  </div>

                  <form onSubmit={handleAISemanticSearch} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-2">
                    <div className="flex flex-col gap-2 md:flex-row">
                      <div className="relative flex-1">
                        <BrainCircuit className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/80" />
                        <input
                          type="text"
                          required
                          value={aiSearchPrompt}
                          onChange={(e) => setAiSearchPrompt(e.target.value)}
                          disabled={aiSearching}
                          placeholder="Find me a quiet travel headset, a low-latency keyboard, or a creator desk upgrade"
                          className="w-full rounded-[18px] border border-transparent bg-transparent py-4 pl-11 pr-4 text-sm text-editorial-text outline-none placeholder:text-editorial-text/32 focus:border-cyan-400/25"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!aiSearchPrompt.trim() || aiSearching}
                        className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#4c82ff,#55d6ff)] px-5 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {aiSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Run AI Search
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap gap-2 text-xs text-editorial-text/54">
                    {["Best compact workstation", "Fitness wearable with long battery", "Premium audio for commuting"].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setAiSearchPrompt(prompt)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-editorial-text"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,39,0.9),rgba(7,11,24,0.78))] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/50">Featured by AI</p>
                    <h2 className="mt-2 text-xl font-semibold text-editorial-text">Signal-ready recommendation</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-editorial-text/58">
                    Live inventory
                  </div>
                </div>

                {heroProduct ? (
                  <div className="mt-5 space-y-4">
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
                      <img src={heroProduct.image} alt={heroProduct.name} className="h-64 w-full object-cover" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-editorial-text/58">
                        <span className="rounded-full border border-white/10 px-3 py-1">{heroProduct.brand || "TechShop"}</span>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">{heroProduct.category}</span>
                      </div>
                      <h3 className="text-2xl font-semibold text-editorial-text">{heroProduct.name}</h3>
                      <p className="line-clamp-3 text-sm leading-6 text-editorial-text/68">{heroProduct.description}</p>
                    </div>
                    <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/52">Starting at</p>
                        <p className="mt-1 text-2xl font-semibold text-editorial-text">{formatCurrency(heroProduct.price)}</p>
                      </div>
                      <button
                        onClick={() => handleProductSelect(heroProduct)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                      >
                        View detail
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-white/10 p-8 text-sm text-editorial-text/55">
                    Catalog preview will appear here when products finish syncing.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
            className="glass-panel glass-border rounded-[32px] p-5 md:p-6"
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/50">Session</p>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-editorial-text">
                {authSession ? authSession.user.email : "Guest browsing mode"}
              </p>
              <p className="mt-1 text-xs text-editorial-text/55">
                {authSession ? `Role: ${authSession.user.role}` : "Sign in to unlock backend checkout and persistent cart sync."}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {isAdminWorkspace && authSession && (
                <button
                  onClick={() => syncAdminData()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh admin data
                </button>
              )}

              {authSession ? (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                    setPhoneConfirmation(null);
                    setAuthDialogOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4c82ff,#7d6bff)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in to sync
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/50">Cart Signal</p>
                <p className="mt-2 text-2xl font-semibold text-editorial-text">{cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
                <p className="mt-1 text-xs text-editorial-text/55">Items ready for basket sync and secure checkout.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/50">Compare Queue</p>
                <p className="mt-2 text-2xl font-semibold text-editorial-text">{comparedProducts.length}/2</p>
                <p className="mt-1 text-xs text-editorial-text/55">Shortlist devices for side-by-side AI analysis.</p>
              </div>
            </div>
          </motion.aside>
        </section>

        {isAdminWorkspace && authSession && (
          <AdminPanel
            user={authSession.user}
            dashboard={adminDashboard}
            users={adminUsers}
            payments={adminPayments}
            reviews={adminReviews}
            loading={adminLoading}
            error={adminError}
            selectedUserId={selectedAdminUserId}
            onRefresh={() => syncAdminData()}
            onSelectUser={handleSelectAdminUser}
            onToggleUserStatus={handleToggleUserStatus}
            onClearLockout={handleClearLockout}
            onChangeUserRole={handleChangeUserRole}
            onDeleteReview={handleDeleteReview}
          />
        )}

        <section className="glass-panel glass-border rounded-[32px] p-5 md:p-6">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/50">Discover</p>
              <h2 className="mt-2 text-2xl font-semibold text-editorial-text md:text-3xl">Premium hardware catalog</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-editorial-text/62">
                Filter by category, scan specs fast, and move from shortlist to AI-assisted detail without losing context.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-editorial-text/55">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                <Filter className="h-3.5 w-3.5" />
                {filteredProducts.length} products visible
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {categories.length - 1} categories synced
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        activeCategory === cat
                          ? "bg-[linear-gradient(135deg,rgba(76,130,255,0.95),rgba(85,214,255,0.95))] text-slate-950"
                          : "border border-white/10 bg-slate-950/35 text-editorial-text/62 hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-editorial-text/38" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product name, brand, category, or standout specs"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/35 py-3.5 pl-11 pr-4 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/30 focus:border-cyan-400/25 focus:bg-slate-950/55"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,39,0.75),rgba(8,14,30,0.55))] p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/48">AI Filter Notes</p>
              <div className="mt-4 space-y-3 text-sm text-editorial-text/68">
                <p>Use natural search for intent. Use category tabs for speed. Use compare for tradeoff decisions.</p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-editorial-text/58">
                  Best for teams: shortlist two devices, open compare, then use the AI report before adding to cart.
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {catalogLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-16 text-center"
              >
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
                <p className="mt-5 text-xl font-semibold text-editorial-text">Synchronizing premium catalog</p>
                <p className="mt-2 text-sm text-editorial-text/55">Loading products, categories, and AI-ready metadata.</p>
              </motion.div>
            ) : filteredProducts.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-16 text-center"
              >
                <Search className="mx-auto h-8 w-8 text-editorial-text/32" />
                <p className="mt-5 text-xl font-semibold text-editorial-text">No products match this filter set</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-editorial-text/55">
                  Try a broader term, switch categories, or reset the search to reopen the full catalog view.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("All");
                  }}
                  className="mt-6 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                >
                  Reset filters
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
              >
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.18) }}
                  >
                    <ProductCard
                      product={product}
                      onViewDetails={handleProductSelect}
                      onAddToCart={handleAddToCart}
                      isCompared={comparedProducts.some((p) => p.id === product.id)}
                      onToggleCompare={handleToggleCompare}
                      isFavorite={favorites.some((p) => p.id === product.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {(aiSearchError || catalogError) && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <p>{aiSearchError || catalogError}</p>
            </div>
          )}
        </section>
      </main>

      {cartOpen && (
        <Cart
          items={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClose={() => setCartOpen(false)}
          onClearCart={handleClearCart}
          onCheckout={handleCheckout}
          requiresSignIn={!isCustomerSession}
        />
      )}

      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          isFavorite={favorites.some((p) => p.id === selectedProduct.id)}
          onToggleFavorite={handleToggleFavorite}
          authSession={authSession}
          onProductRefresh={handleProductRefresh}
        />
      )}

      {favoritesOpen && (
        <Favorites items={favorites} onRemoveFavorite={handleToggleFavorite} onAddToCart={handleAddToCart} onClose={() => setFavoritesOpen(false)} />
      )}

      {comparisonOpen && (
        <ComparisonModal
          products={comparedProducts}
          onRemove={handleRemoveCompare}
          onClose={() => setComparisonOpen(false)}
          allProducts={products}
          onSelectProduct={(product) => setComparedProducts((prev) => [...prev, product])}
        />
      )}

      <AIChatBot products={products} selectedProductId={selectedProduct?.id} />

      <AuthDialog
        open={authDialogOpen}
        mode={authMode}
        busy={authBusy}
        error={authError}
        phoneVerificationPending={phoneConfirmation !== null}
        onClose={() => {
          setAuthDialogOpen(false);
          setPhoneConfirmation(null);
          setAuthError(null);
        }}
        onSubmit={handleAuthSubmit}
        onModeChange={setAuthMode}
        onGoogleSignIn={handleGoogleSignIn}
        onPhoneSendCode={handlePhoneSendCode}
        onPhoneVerifyCode={handlePhoneVerifyCode}
        onPhoneReset={handlePhoneReset}
      />

      <footer className="relative z-10 mx-auto mt-8 max-w-7xl px-4 pb-10 md:px-8">
        <div className="glass-panel glass-border rounded-[28px] px-6 py-5 text-center text-xs uppercase tracking-[0.18em] text-editorial-text/45">
          <div>TechShop AI Commerce Interface</div>
          <div className="mt-2 text-[11px] tracking-[0.16em] text-editorial-text/32">Premium storefront layer on top of your existing catalog, auth, cart, and review logic</div>
        </div>
      </footer>
    </div>
  );
}
