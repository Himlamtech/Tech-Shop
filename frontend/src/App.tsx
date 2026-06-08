import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import ProductCard from "./components/ProductCard";
import ProductDetails from "./components/ProductDetails";
import ComparisonModal from "./components/ComparisonModal";
import AIChatBot from "./components/AIChatBot";
import Cart from "./components/Cart";
import Favorites from "./components/Favorites";
import AuthDialog from "./components/AuthDialog";
import AdminPanel from "./components/AdminPanel";
import { authenticate, loadStoredSession, logoutSession, persistSession } from "./auth";
import { deleteAdminReview, fetchAdminDashboard, fetchAdminPayments, fetchAdminReviews, fetchAdminUserDetail, fetchAdminUsers, updateAdminUser } from "./admin";
import { AdminDashboardData, AdminPaymentRecord, AdminReviewRecord, AdminUserRecord, AuthSession, CartItem, CategoryNode, Product } from "./types";
import { Search, Sparkles, RefreshCw, AlertCircle, LogIn, LogOut } from "lucide-react";
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
    }
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

  const handleAuthSubmit = async (values: { email: string; password: string }) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await authenticate(authMode, values);
      persistSession(session);
      setAuthSession(session);
      setAuthDialogOpen(false);
      if (session.user.role === "admin") {
        await syncAdminData(session);
      }
      if (session.user.role === "customer" && products.length > 0) {
        const remoteCart = await fetchRemoteCart(session, setAuthSession, productLookup);
        setCart(remoteCart);
      }
    } catch (error: any) {
      setAuthError(error?.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    if (authSession?.refreshToken) {
      try {
        await logoutSession(authSession.refreshToken);
      } catch {
        // Clear local session even if the service already revoked the token.
      }
    }
    persistSession(null);
    setAuthSession(null);
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

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-text relative pb-16 selection:bg-editorial-accent selection:text-editorial-dark">
      <div className="border-t border-editorial-text/10" />

      <Navbar
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setCartOpen(true)}
        comparedCount={comparedProducts.length}
        onCompareClick={() => setComparisonOpen(true)}
        onAICompanionClick={() => {
          const btn = document.getElementById("nav-ai-button");
          if (btn) btn.click();
        }}
        favoritesCount={favorites.length}
        onFavoritesClick={() => setFavoritesOpen(true)}
      />

      <section className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="text-xs uppercase tracking-[0.18em] text-editorial-text/55">
          {authSession ? `Session active: ${authSession.user.email} / ${authSession.user.role}` : "Guest browsing mode"}
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdminWorkspace && authSession && (
            <button onClick={() => syncAdminData()} className="border border-editorial-text/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-dark">
              Open Admin Sync
            </button>
          )}
          {authSession ? (
            <button onClick={handleLogout} className="flex items-center gap-2 border border-editorial-text bg-editorial-text px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-bg">
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
                setAuthDialogOpen(true);
              }}
              className="flex items-center gap-2 border border-editorial-text bg-editorial-text px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-bg"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
          )}
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

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 space-y-12">
        <section className="text-center max-w-4xl mx-auto space-y-5 animate-in fade-in slide-in-from-top-3 duration-500 pt-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-editorial-text/15 bg-editorial-accent/20 text-editorial-text cap-text select-none">
            <Sparkles className="w-2.5 h-2.5 opacity-70" />
            <span>Issue No. 04 — Modernist Hardware</span>
          </div>

          <h1 className="serif text-4xl md:text-7xl font-bold text-editorial-text tracking-tighter leading-[0.95] py-2">
            Future Hardware,<br />
            <span className="serif italic text-editorial-text/75 font-normal">Decided with AI Clarity.</span>
          </h1>

          <p className="text-xs md:text-sm text-editorial-text max-w-[585px] mx-auto leading-relaxed opacity-75 font-sans">
            Explore the live catalog from the backend, compare hardware side-by-side, and move from discovery to checkout without drifting away from the database truth.
          </p>
        </section>

        <section className="bg-editorial-paper border border-editorial-text/15 rounded-none p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-5 relative">
              <label className="text-[9px] text-editorial-text font-bold uppercase tracking-wider font-mono mb-2 block">Keyword lookup</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-3.5 h-3.5 text-editorial-text/45" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query by keys, specs, or metrics..."
                  className="w-full text-xs bg-editorial-bg border border-editorial-text/20 focus:border-editorial-text focus:outline-none rounded-none pl-9 pr-3 py-3 transition-all duration-200 font-sans text-editorial-text"
                />
              </div>
            </div>

            <div className="hidden md:flex md:col-span-1 pb-3 justify-center text-[10px] font-mono text-editorial-text/50 uppercase tracking-widest font-semibold">/</div>

            <form onSubmit={handleAISemanticSearch} className="md:col-span-6 relative font-sans">
              <label className="text-[9px] text-editorial-text font-bold uppercase tracking-wider font-mono mb-2 block flex items-center justify-between">
                <span>AI Intent Alignment</span>
                <span className="text-[8px] tracking-normal font-mono opacity-50 font-normal">Catalog-aware match</span>
              </label>
              <div className="relative flex gap-2">
                <input
                  type="text"
                  required
                  value={aiSearchPrompt}
                  onChange={(e) => setAiSearchPrompt(e.target.value)}
                  disabled={aiSearching}
                  placeholder="Describe goal: 'I need a travel audio setup with strong ANC'..."
                  className="flex-grow text-xs bg-editorial-bg border border-editorial-text/25 focus:border-editorial-text focus:outline-none rounded-none pl-3.5 pr-10 py-3 transition-all duration-250 italic text-editorial-text"
                />
                <button type="submit" disabled={!aiSearchPrompt.trim() || aiSearching} className="bg-editorial-text text-editorial-bg hover:bg-editorial-accent hover:text-editorial-text border border-editorial-text rounded-none px-4.5 flex items-center justify-center gap-1.5 shrink-0 transition-colors duration-250 disabled:opacity-40">
                  {aiSearching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase tracking-wider font-mono hidden sm:inline">Search AI</span></>}
                </button>
              </div>
            </form>
          </div>

          {(aiSearchError || catalogError) && (
            <div className="p-3 bg-red-55/10 border border-red-500/20 text-red-900 text-xs rounded-none flex items-start gap-2.5 animate-in fade-in duration-200 font-mono">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <p>{aiSearchError || catalogError}</p>
            </div>
          )}
        </section>

        <section className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-editorial-text/15 pb-5">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[10px] uppercase tracking-wider py-2 px-4 rounded-none transition-all duration-250 cursor-pointer ${activeCategory === cat ? "bg-editorial-text text-editorial-bg font-bold border border-editorial-text" : "bg-transparent text-editorial-text/60 border border-editorial-text/10 hover:border-editorial-text/50 hover:text-editorial-text"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-editorial-text/50 font-mono tracking-widest uppercase">Manifest — {filteredProducts.length} curations verified</p>
          </div>

          {catalogLoading ? (
            <div className="bg-editorial-paper rounded-none border border-editorial-text/15 p-16 text-center space-y-5">
              <RefreshCw className="w-8 h-8 text-editorial-text/40 mx-auto animate-spin" />
              <p className="serif text-xl font-bold text-editorial-text">Synchronizing live catalog</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-editorial-paper rounded-none border border-editorial-text/15 p-16 text-center space-y-5">
              <Search className="w-8 h-8 text-editorial-text/30 mx-auto" />
              <div className="space-y-2">
                <p className="serif text-xl font-bold text-editorial-text">No corresponding devices located</p>
                <p className="text-xs text-editorial-text/60 max-w-sm mx-auto font-sans leading-relaxed">We could not pinpoint matching hardware items matching current indexing keywords in this collection.</p>
              </div>
              <button onClick={() => { setSearchQuery(""); setActiveCategory("All"); }} className="text-[10px] uppercase tracking-widest font-bold bg-editorial-text text-editorial-bg px-5 py-2.5 rounded-none border border-editorial-text hover:bg-transparent hover:text-editorial-text transition-colors duration-250 cursor-pointer">
                Reset Layout filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={handleProductSelect}
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

      <AuthDialog open={authDialogOpen} mode={authMode} busy={authBusy} error={authError} onClose={() => setAuthDialogOpen(false)} onSubmit={handleAuthSubmit} onModeChange={setAuthMode} />

      <footer className="border-t border-editorial-text/15 py-8 text-center text-[9px] text-editorial-text/45 font-mono tracking-widest uppercase mt-16 space-y-2 max-w-5xl mx-auto">
        <div>THE ARCHIVE — CURATED INTELLECTUAL HARDWARE FOR CONTEMPORARY DESIGNS</div>
        <div className="opacity-60 text-[8px]">SERIES 2026 © ALL SPECULATIONS AUTHORIZED UNDER DISTRIBUTED CREDENTIALS</div>
      </footer>
    </div>
  );
}
