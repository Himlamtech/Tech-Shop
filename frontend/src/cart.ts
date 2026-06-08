import { parseApiResponse } from "./api";
import { authorizedFetch } from "./auth";
import { AuthSession, CartItem, Product } from "./types";

const CART_BASE_URL = import.meta.env.VITE_CART_BASE_URL || "/api/cart";

interface RemoteCartItem {
  id: string;
  product_id: string;
  name: string;
  thumbnail: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
}

interface RemoteCart {
  id: string;
  user_id: string;
  subtotal: string;
  items: RemoteCartItem[];
}

function fallbackProduct(item: RemoteCartItem): Product {
  return {
    id: item.product_id,
    name: item.name,
    price: Number(item.unit_price),
    category: "Catalog Item",
    rating: 0,
    reviewsCount: 0,
    description: "Loaded from your synchronized cart.",
    tag: "Cart Sync",
    image: item.thumbnail || "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800",
    features: ["Backend validated item"],
    specs: [{ label: "Cart item", value: "Synchronized" }],
    reviews: [],
    aiOverview: "This item is synchronized from the cart service.",
  };
}

function mapRemoteCart(cart: RemoteCart, productLookup: Map<string, Product>) {
  return cart.items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    product: productLookup.get(item.product_id) || fallbackProduct(item),
    quantity: item.quantity,
    lineTotal: Number(item.line_total),
    synced: true,
  } satisfies CartItem));
}

async function performCartRequest(
  path: string,
  init: RequestInit,
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  const response = await authorizedFetch(`${CART_BASE_URL}${path}`, init, session, onSessionRefresh);
  const { data } = await parseApiResponse<RemoteCart>(response);
  return mapRemoteCart(data, productLookup);
}

export async function fetchRemoteCart(
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  return performCartRequest("/current", {}, session, onSessionRefresh, productLookup);
}

export async function addRemoteCartItem(
  productId: string,
  quantity: number,
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  return performCartRequest(
    "/items",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity }),
    },
    session,
    onSessionRefresh,
    productLookup,
  );
}

export async function updateRemoteCartItem(
  itemId: string,
  quantity: number,
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  return performCartRequest(
    `/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    },
    session,
    onSessionRefresh,
    productLookup,
  );
}

export async function removeRemoteCartItem(
  itemId: string,
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  return performCartRequest(`/items/${itemId}`, { method: "DELETE" }, session, onSessionRefresh, productLookup);
}

export async function clearRemoteCart(
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
  productLookup: Map<string, Product>,
) {
  return performCartRequest("/current/items", { method: "DELETE" }, session, onSessionRefresh, productLookup);
}
