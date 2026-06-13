import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Headphones,
  Laptop,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  Truck,
  Zap,
  ZapOff,
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
import CustomerProfile from "./components/CustomerProfile";
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
import { PRODUCTS } from "./products";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeBrand, setActiveBrand] = useState("All");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000000]);

  const productLookup = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categories = useMemo(() => {
    const fromApi = flattenCategories(categoriesTree);
    const fromProducts = products.map((product) => product.category).filter(Boolean);
    return ["All", ...Array.from(new Set([...fromApi, ...fromProducts]))];
  }, [categoriesTree, products]);
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
        setProducts(PRODUCTS);
        setCategoriesTree([]);
        setCatalogError(null);
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

  // Featured product auto-rotation every 4 seconds
  useEffect(() => {
    if (products.length === 0) return;
    featuredTimerRef.current = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % Math.min(products.length, 8));
    }, 4000);
    return () => {
      if (featuredTimerRef.current) clearInterval(featuredTimerRef.current);
    };
  }, [products.length]);

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
    const matchesBrand = activeBrand === "All" || product.brand === activeBrand;
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const haystack = [product.name, product.description, product.category, product.brand, ...product.features].join(" ").toLowerCase();
    return matchesCategory && matchesBrand && matchesPrice && haystack.includes(searchQuery.toLowerCase());
  });

  const brandsForCategory = useMemo(() => {
    const source = activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);
    return ["All", ...Array.from(new Set(source.map((p) => p.brand).filter(Boolean))).sort()];
  }, [products, activeCategory]);

  const maxPrice = useMemo(() => {
    if (products.length === 0) return 100000000;
    return Math.max(...products.map((p) => p.price));
  }, [products]);

  const featuredProducts = products.slice(0, 8);
  const heroProduct = featuredProducts[featuredIndex] ?? products[0] ?? null;

  const CATEGORY_SHORTCUTS = [
    { label: "Điện thoại", value: "Smartphones", icon: <Smartphone className="h-5 w-5" /> },
    { label: "Laptop", value: "Laptops", icon: <Laptop className="h-5 w-5" /> },
    { label: "Tai nghe", value: "Tai nghe", icon: <Headphones className="h-5 w-5" /> },
    { label: "Đồng hồ", value: "Đồng hồ thông minh", icon: <RefreshCw className="h-5 w-5" /> },
    { label: "Máy tính bảng", value: "Máy tính bảng", icon: <Tablet className="h-5 w-5" /> },
    { label: "Sạc điện thoại", value: "Sạc điện thoại", icon: <Zap className="h-5 w-5" /> },
    { label: "Sạc dự phòng", value: "Sạc dự phòng", icon: <ZapOff className="h-5 w-5" /> },
    { label: "Phụ kiện", value: "Phụ kiện", icon: <Phone className="h-5 w-5" /> },
    { label: "Cáp & Hub", value: "Cáp & Hub", icon: <Truck className="h-5 w-5" /> },
  ];

  const recommendedProducts = useMemo(() => {
    if (products.length === 0) return [];
    const scored = products.map((p) => ({
      product: p,
      score: (p.rating ?? 0) * 20 + (p.reviewCount ?? 0) * 0.5 + (p.price > 500 ? 10 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.product);
  }, [products]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-editorial-bg text-editorial-text">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent_34%)]" />

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
        onProfileClick={() => setProfileOpen(true)}
      />

      <main className="relative z-10 mx-auto flex max-w-[1600px] flex-col gap-8 px-4 pb-20 pt-6 md:px-8 md:pt-10">
        {/* Hero / Featured rotation */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="overflow-hidden rounded-2xl border border-stone-900/10 bg-white shadow-[0_24px_80px_rgba(112,82,48,0.14)]"
          >
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
              <div className="p-6 md:p-10 lg:p-14">
                <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-stone-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-editorial-text/58">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Sản phẩm chính hãng, bảo hành đầy đủ
                </div>
                <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-tight text-editorial-text md:text-7xl">
                  Nâng cấp công nghệ tại Lamania.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-editorial-text/66 md:text-lg">
                  Mua điện thoại, laptop, tai nghe, phụ kiện với thông số rõ ràng và thanh toán nhanh chóng.
                </p>

                <div className="mt-8 max-w-4xl rounded-2xl border border-stone-900/10 bg-stone-50 p-3 md:p-4">
                  <form onSubmit={handleAISemanticSearch} className="rounded-xl border border-stone-900/10 bg-white p-2 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-editorial-text/42" />
                        <input
                          type="text"
                          required
                          value={aiSearchPrompt}
                          onChange={(e) => setAiSearchPrompt(e.target.value)}
                          disabled={aiSearching}
                          placeholder="Tìm điện thoại, laptop, tai nghe, phụ kiện..."
                          className="w-full rounded-lg border border-transparent bg-transparent py-4 pl-13 pr-4 text-base text-editorial-text outline-none placeholder:text-editorial-text/40 focus:border-amber-700/25 md:text-lg"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!aiSearchPrompt.trim() || aiSearching}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-editorial-text px-7 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {aiSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Tìm kiếm
                      </button>
                    </div>
                  </form>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-editorial-text/58">
                    {["Điện thoại Samsung", "Tai nghe chống ồn", "Laptop gaming", "Sạc dự phòng"].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setAiSearchPrompt(prompt)}
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 transition hover:border-amber-700/30 hover:bg-amber-700/10 hover:text-editorial-text"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Giao hàng nhanh", "Miễn phí từ 500.000 VNĐ"],
                    ["Thanh toán an toàn", "COD, thẻ, ví điện tử"],
                    ["Tư vấn AI", "Hỏi AI trước khi mua"],
                  ].map(([label, meta]) => (
                    <div key={label} className="rounded-xl border border-stone-900/10 bg-stone-50 p-4">
                      <p className="text-sm font-semibold text-editorial-text">{label}</p>
                      <p className="mt-1 text-xs text-editorial-text/55">{meta}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Featured rotation panel */}
              <div className="border-t border-stone-900/10 bg-[#f7f1e6] p-5 md:p-8 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/50">Nổi bật</p>
                    <h2 className="mt-2 text-xl font-semibold text-editorial-text">Hôm nay tại Lamania</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (featuredTimerRef.current) clearInterval(featuredTimerRef.current);
                        setFeaturedIndex((prev) => (prev - 1 + featuredProducts.length) % Math.max(1, featuredProducts.length));
                        featuredTimerRef.current = setInterval(() => {
                          setFeaturedIndex((p) => (p + 1) % Math.min(products.length, 8));
                        }, 4000);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-900/10 bg-white/70 text-editorial-text/55 transition hover:bg-white hover:text-editorial-text"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (featuredTimerRef.current) clearInterval(featuredTimerRef.current);
                        setFeaturedIndex((prev) => (prev + 1) % Math.max(1, featuredProducts.length));
                        featuredTimerRef.current = setInterval(() => {
                          setFeaturedIndex((p) => (p + 1) % Math.min(products.length, 8));
                        }, 4000);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-900/10 bg-white/70 text-editorial-text/55 transition hover:bg-white hover:text-editorial-text"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Dot indicators */}
                {featuredProducts.length > 1 && (
                  <div className="mt-3 flex gap-1.5">
                    {featuredProducts.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFeaturedIndex(i)}
                        className={`h-1.5 rounded-full transition-all ${i === featuredIndex ? "w-6 bg-amber-700" : "w-1.5 bg-stone-900/20 hover:bg-stone-900/40"}`}
                      />
                    ))}
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {heroProduct ? (
                    <motion.div
                      key={heroProduct.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.3 }}
                      className="mt-5 space-y-4"
                    >
                      <div className="overflow-hidden rounded-2xl border border-stone-900/10 bg-white shadow-sm">
                        <img src={heroProduct.image} alt={heroProduct.name} className="h-[300px] w-full object-cover" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-editorial-text/58">
                          <span className="rounded-full border border-stone-900/10 px-3 py-1">{heroProduct.brand || "Lamania"}</span>
                          <span className="rounded-full border border-amber-700/20 bg-amber-700/10 px-3 py-1 text-amber-800">{heroProduct.category}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-editorial-text">{heroProduct.name}</h3>
                        <p className="line-clamp-2 text-sm leading-6 text-editorial-text/68">{heroProduct.description}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-stone-900/10 bg-white p-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/52">Giá từ</p>
                          <p className="mt-1 text-xl font-semibold text-editorial-text">{formatCurrency(heroProduct.price)}</p>
                        </div>
                        <button
                          onClick={() => handleProductSelect(heroProduct)}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/65 px-4 py-2 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10"
                        >
                          Xem chi tiết
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-stone-900/10 bg-white/60 p-8 text-sm text-editorial-text/55">
                      Đang tải sản phẩm...
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Category shortcuts */}
        <section>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {CATEGORY_SHORTCUTS.map(({ label, value, icon }) => (
              <button
                key={value}
                onClick={() => {
                  setActiveCategory(value);
                  setActiveBrand("All");
                  document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-xs font-medium transition ${
                  activeCategory === value
                    ? "border-amber-700/30 bg-amber-700/10 text-amber-800"
                    : "border-stone-900/10 bg-white text-editorial-text/65 hover:border-amber-700/20 hover:bg-amber-700/5 hover:text-editorial-text"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeCategory === value ? "bg-amber-700/15 text-amber-700" : "bg-stone-100 text-editorial-text/55"}`}>
                  {icon}
                </div>
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
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

        {/* AI Recommendations carousel */}
        {recommendedProducts.length > 0 && (
          <section className="rounded-2xl border border-stone-900/10 bg-white p-5 shadow-[0_20px_70px_rgba(112,82,48,0.10)] md:p-6">
            <div className="flex items-center justify-between border-b border-stone-900/10 pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/50">Gợi ý cho bạn</p>
                <h2 className="mt-2 text-xl font-semibold text-editorial-text">Sản phẩm nổi bật</h2>
              </div>
              <MessageCircle className="h-5 w-5 text-amber-700/60" />
            </div>
            <div className="mt-5 flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {recommendedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group w-[200px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-stone-900/10 bg-stone-50 transition hover:border-amber-700/25 hover:shadow-md"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="h-[140px] overflow-hidden bg-white">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-semibold text-editorial-text">{product.name}</p>
                    <p className="mt-1 text-xs text-amber-700 font-medium">{formatCurrency(product.price)}</p>
                    {product.rating != null && (
                      <p className="mt-1 text-[10px] text-editorial-text/50">★ {product.rating.toFixed(1)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Products with right sidebar */}
        <section id="products-section" className="rounded-2xl border border-stone-900/10 bg-white p-5 shadow-[0_20px_70px_rgba(112,82,48,0.10)] md:p-6">
          <div className="flex items-center justify-between border-b border-stone-900/10 pb-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/50">Mua sắm</p>
              <h2 className="mt-2 text-2xl font-semibold text-editorial-text md:text-3xl">Sản phẩm</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-editorial-text/55">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-900/10 bg-white/65 px-3 py-2">
                <Filter className="h-3.5 w-3.5" />
                {filteredProducts.length} sản phẩm
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row">
            {/* Right sidebar: filters */}
            <aside className="order-first w-full shrink-0 lg:order-last lg:w-[220px]">
              <div className="sticky top-24 space-y-4">
                {/* Category filter */}
                <div className="rounded-[8px] border border-stone-900/10 bg-stone-50 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Danh mục</p>
                  <div className="flex flex-col gap-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setActiveBrand("All"); }}
                        className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                          activeCategory === cat
                            ? "bg-amber-700/15 text-amber-800"
                            : "text-editorial-text/65 hover:bg-stone-100 hover:text-editorial-text"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand filter */}
                {brandsForCategory.length > 2 && (
                  <div className="rounded-[8px] border border-stone-900/10 bg-stone-50 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Thương hiệu</p>
                    <div className="flex flex-col gap-1">
                      {brandsForCategory.map((brand) => (
                        <button
                          key={brand}
                          onClick={() => setActiveBrand(brand)}
                          className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            activeBrand === brand
                              ? "bg-amber-700/15 text-amber-800"
                              : "text-editorial-text/65 hover:bg-stone-100 hover:text-editorial-text"
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price range filter */}
                <div className="rounded-[8px] border border-stone-900/10 bg-stone-50 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Khoảng giá</p>
                  <div className="space-y-3">
                    {[
                      { label: "Tất cả", min: 0, max: 100000000 },
                      { label: "Dưới 500.000đ", min: 0, max: 500000 },
                      { label: "500K – 2 triệu", min: 500000, max: 2000000 },
                      { label: "2 – 10 triệu", min: 2000000, max: 10000000 },
                      { label: "10 – 30 triệu", min: 10000000, max: 30000000 },
                      { label: "30 – 60 triệu", min: 30000000, max: 60000000 },
                      { label: "Trên 60 triệu", min: 60000000, max: 100000000 },
                    ].map(({ label, min, max }) => (
                      <button
                        key={label}
                        onClick={() => setPriceRange([min, max])}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                          priceRange[0] === min && priceRange[1] === max
                            ? "bg-amber-700/15 text-amber-800"
                            : "text-editorial-text/65 hover:bg-stone-100 hover:text-editorial-text"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset filters */}
                {(activeCategory !== "All" || activeBrand !== "All" || priceRange[0] !== 0 || priceRange[1] !== 100000000) && (
                  <button
                    onClick={() => { setActiveCategory("All"); setActiveBrand("All"); setPriceRange([0, 100000000]); }}
                    className="w-full rounded-[8px] border border-stone-900/10 bg-white px-3 py-2.5 text-sm font-semibold text-editorial-text/65 transition hover:border-amber-700/25 hover:text-amber-800"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </aside>

            {/* Main area: search + grid */}
            <div className="min-w-0 flex-1">
              {/* Search + Ask AI bar */}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-editorial-text/38" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên sản phẩm, thương hiệu, thông số..."
                    className="w-full rounded-[8px] border border-stone-900/10 bg-stone-50 py-3 pl-11 pr-4 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/34 focus:border-amber-700/25 focus:bg-white"
                  />
                </div>
                <button
                  onClick={() => document.getElementById("techshop-ai-launcher")?.click()}
                  className="inline-flex items-center gap-2 rounded-[8px] border border-amber-700/25 bg-amber-700/10 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-700/15"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hỏi AI
                </button>
              </div>

              <AnimatePresence mode="wait">
                {catalogLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="rounded-[28px] border border-stone-900/10 bg-white/65 p-16 text-center"
                  >
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-amber-700" />
                    <p className="mt-5 text-xl font-semibold text-editorial-text">Đang đồng bộ danh mục</p>
                    <p className="mt-2 text-sm text-editorial-text/55">Đang tải sản phẩm và danh mục.</p>
                  </motion.div>
                ) : filteredProducts.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="rounded-[28px] border border-stone-900/10 bg-white/65 p-16 text-center"
                  >
                    <Search className="mx-auto h-8 w-8 text-editorial-text/32" />
                    <p className="mt-5 text-xl font-semibold text-editorial-text">Không tìm thấy sản phẩm</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-editorial-text/55">
                      Thử từ khóa khác hoặc chọn danh mục khác.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("All");
                      }}
                      className="mt-6 rounded-full border border-stone-900/10 bg-white/70 px-5 py-3 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10"
                    >
                      Xóa bộ lọc
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
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
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <p>{aiSearchError || catalogError}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Full footer */}
      <footer className="relative z-10 mt-8 border-t border-stone-900/10 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-amber-700/20 bg-amber-700/10 text-amber-800">
                  <Smartphone className="h-5 w-5" />
                </div>
                <span className="text-xl font-extrabold text-editorial-text">Lamania</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-editorial-text/60">
                Cửa hàng công nghệ chính hãng — điện thoại, laptop, tai nghe và phụ kiện cao cấp.
              </p>
              <div className="mt-5 space-y-2 text-sm text-editorial-text/60">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Km10, Đường Nguyễn Trãi, Hà Đông, Hà Nội</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>1800 6242</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>support@lamania.vn</span>
                </div>
              </div>
            </div>

            {/* Danh mục */}
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Danh mục</p>
              <ul className="space-y-2.5 text-sm text-editorial-text/65">
                {["Smartphones", "Laptops", "Tai nghe", "Đồng hồ thông minh", "Máy tính bảng", "Sạc điện thoại", "Sạc dự phòng", "Phụ kiện", "Cáp & Hub"].map((cat) => (
                  <li key={cat}>
                    <button
                      onClick={() => {
                        setActiveCategory(cat);
                        document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="transition hover:text-amber-800"
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hỗ trợ */}
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Hỗ trợ</p>
              <ul className="space-y-2.5 text-sm text-editorial-text/65">
                {[
                  "Chính sách bảo hành",
                  "Hướng dẫn mua hàng",
                  "Chính sách đổi trả",
                  "Tra cứu đơn hàng",
                  "Liên hệ tư vấn",
                  "Câu hỏi thường gặp",
                ].map((item) => (
                  <li key={item}>
                    <span className="transition hover:text-amber-800 cursor-default">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Google Map */}
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-editorial-text/50">Địa chỉ cửa hàng</p>
              <div className="overflow-hidden rounded-2xl border border-stone-900/10 shadow-sm">
                <iframe
                  title="Lamania Store Location - PTIT"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.7!2d105.7792!3d20.9811!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135accdd8a1ad71%3A0xa2f9b16036648187!2zSOG7jWMgdmnhu4duIEPDtG5nIG5naOG7hyBCxrB1IGNow61uaCBWaeG7hW4gdGjDtG5n!5e0!3m2!1svi!2svn!4v1700000000000!5m2!1svi!2svn"
                  width="100%"
                  height="180"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/20 bg-emerald-700/10 px-3 py-1.5 text-xs font-medium text-emerald-800">
                  <Truck className="h-3 w-3" />
                  Giao hàng toàn quốc
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-stone-900/10 pt-6 text-xs text-editorial-text/45 sm:flex-row">
            <p>© 2025 Lamania. Tất cả quyền được bảo lưu.</p>
            <p>Học viện Công nghệ Bưu chính Viễn thông — PTIT, Hà Nội</p>
          </div>
        </div>
      </footer>

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

      {profileOpen && authSession && (
        <CustomerProfile
          authSession={authSession}
          onClose={() => setProfileOpen(false)}
          onSessionRefresh={setAuthSession}
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
    </div>
  );
}
