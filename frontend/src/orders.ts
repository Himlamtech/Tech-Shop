import { parseApiResponse } from "./api";
import { authorizedFetch } from "./auth";
import { AuthSession } from "./types";

const ORDER_BASE_URL = import.meta.env.VITE_ORDER_BASE_URL || "/api/orders";

interface CheckoutResponse {
  id: string;
  status: string;
  total_amount: string;
}

export async function checkoutOrder(
  shippingAddress: string,
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${ORDER_BASE_URL}/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping_address: shippingAddress }),
    },
    session,
    onSessionRefresh,
  );

  const { data } = await parseApiResponse<CheckoutResponse>(response);
  return data;
}
