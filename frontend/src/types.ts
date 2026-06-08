export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  userId?: string;
  sentimentLabel?: string | null;
  sentimentStatus?: string;
}

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  categorySlug?: string;
  rating: number;
  reviewsCount: number;
  description: string;
  tag: string;
  image: string;
  features: string[];
  specs: Spec[];
  reviews: Review[];
  aiOverview: string;
  sku?: string;
  slug?: string;
  stock?: number;
  brand?: string;
  status?: string;
  images?: string[];
  rawAttributes?: Record<string, unknown> | null;
}

export interface CartItem {
  id?: string;
  productId?: string;
  product: Product;
  quantity: number;
  lineTotal?: number;
  synced?: boolean;
}

export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff" | "customer";
  is_active?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  user: AuthUser;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  level: number;
  children: CategoryNode[];
}

export interface AdminDashboardData {
  identity: {
    total_users: number;
    active_users: number;
    locked_users: number;
    users_by_role: Record<string, number>;
  };
  catalog: {
    total_products?: number;
    active_products?: number;
    total_categories?: number;
  };
  orders: {
    total_orders?: number;
    total_revenue?: string;
    orders_by_status?: Record<string, number>;
  };
  payments: {
    total_transactions?: number;
    total_amount?: string;
    successful_amount?: string;
    transactions_by_status?: Record<string, number>;
  };
  reviews: {
    total_reviews?: number;
    average_rating?: number;
    reviews_by_sentiment?: Record<string, number>;
  };
}

export interface AdminUserRecord {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AdminPaymentRecord {
  id: string;
  order_id: string;
  amount: string;
  status: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface AdminReviewRecord {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment: string;
  sentiment_label: string | null;
  sentiment_score: number | null;
  sentiment_status: string;
  created_at: string;
}
