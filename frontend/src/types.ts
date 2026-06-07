export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
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
  rating: number;
  reviewsCount: number;
  description: string;
  tag: string;
  image: string;
  features: string[];
  specs: Spec[];
  reviews: Review[];
  aiOverview: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
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
