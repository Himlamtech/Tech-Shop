import { parseApiResponse } from "./api";
import { CategoryNode, Product, Review, Spec } from "./types";

const CATALOG_BASE_URL = import.meta.env.VITE_CATALOG_BASE_URL || "/api/catalog";
const REVIEW_BASE_URL = import.meta.env.VITE_REVIEW_BASE_URL || "/api/reviews";

interface CatalogProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: string;
  stock: number;
  brand: string;
  category_name: string;
  status: string;
  rating_avg: string;
  rating_count: number;
  thumbnail_url: string | null;
}

interface CatalogProductDetail {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: number;
  brand: string;
  category: CategoryNode;
  status: string;
  attributes: Record<string, unknown> | null;
  rating_avg: string;
  rating_count: number;
  images: Array<{ image_url: string; is_primary: boolean }>;
}

interface ProductReviewsPayload {
  average_rating: number;
  total_reviews: number;
  reviews: Array<{
    id: string;
    user_id: string;
    rating: number;
    comment: string;
    sentiment_label: string | null;
    sentiment_status: string;
    created_at: string;
  }>;
}

function buildCatalogUrl(path: string) {
  return `${CATALOG_BASE_URL}${path}`;
}

function buildReviewUrl(path: string) {
  return `${REVIEW_BASE_URL}${path}`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function buildSpecs(attributes: Record<string, unknown> | null, brand?: string, stock?: number): Spec[] {
  const specsFromAttrs = Array.isArray(attributes?.specs)
    ? (attributes?.specs as Array<{ label?: unknown; value?: unknown }>)
        .filter((item) => typeof item?.label === "string" && typeof item?.value === "string")
        .map((item) => ({ label: String(item.label), value: String(item.value) }))
    : [];

  if (specsFromAttrs.length > 0) {
    return specsFromAttrs;
  }

  const specs: Spec[] = [];
  if (brand) specs.push({ label: "Brand", value: brand });
  if (typeof stock === "number") specs.push({ label: "Stock", value: `${stock}` });

  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (["features", "specs", "tag", "aiOverview"].includes(key)) return;
    if (value === null || typeof value === "object") return;
    specs.push({
      label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      value: String(value),
    });
  });

  return specs;
}

function buildProduct(detail: CatalogProductDetail, reviews: Review[] = []): Product {
  const attributes = detail.attributes || {};
  const imageUrls = detail.images.map((item) => item.image_url);
  const features = asStringArray(attributes.features);

  return {
    id: detail.id,
    sku: detail.sku,
    slug: detail.slug,
    name: detail.name,
    price: Number(detail.price),
    category: detail.category.name,
    categorySlug: detail.category.slug,
    rating: Number(detail.rating_avg || 0),
    reviewsCount: detail.rating_count,
    description: detail.description || "No product description available yet.",
    tag: typeof attributes.tag === "string" ? attributes.tag : detail.brand,
    image: imageUrls[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800",
    images: imageUrls,
    features: features.length > 0 ? features : [detail.brand, `${detail.stock} units ready`].filter(Boolean),
    specs: buildSpecs(detail.attributes, detail.brand, detail.stock),
    reviews,
    aiOverview:
      typeof attributes.aiOverview === "string"
        ? attributes.aiOverview
        : `${detail.name} from ${detail.brand} currently carries a ${detail.rating_avg}/5 rating and ${detail.stock} units in stock.`,
    stock: detail.stock,
    brand: detail.brand,
    status: detail.status,
    rawAttributes: detail.attributes,
  };
}

export async function fetchCategories() {
  const response = await fetch(buildCatalogUrl("/categories/"));
  const { data } = await parseApiResponse<CategoryNode[]>(response);
  return data;
}

export async function fetchCatalogProducts() {
  const aggregated: CatalogProductListItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const listResponse = await fetch(buildCatalogUrl(`/products/?page=${page}&page_size=50`));
    const { data, meta } = await parseApiResponse<CatalogProductListItem[]>(listResponse);
    aggregated.push(...data);
    totalPages = meta?.pagination?.total_pages || 1;
    page += 1;
  }

  const detailedProducts = await Promise.all(
    aggregated.map(async (product) => {
      const detailResponse = await fetch(buildCatalogUrl(`/products/${product.id}/`));
      const { data: detail } = await parseApiResponse<CatalogProductDetail>(detailResponse);
      return buildProduct(detail);
    }),
  );

  return detailedProducts.filter((product) => product.status !== "inactive");
}

export async function fetchProductReviews(productId: string) {
  const response = await fetch(buildReviewUrl(`/product/${productId}?page_size=20`));
  const { data } = await parseApiResponse<ProductReviewsPayload>(response);
  return data.reviews.map((review) => ({
    id: review.id,
    author: `Customer ${review.user_id.slice(0, 8)}`,
    rating: review.rating,
    text: review.comment,
    date: new Date(review.created_at).toLocaleDateString("en-CA"),
    userId: review.user_id,
    sentimentLabel: review.sentiment_label,
    sentimentStatus: review.sentiment_status,
  } satisfies Review));
}

export async function fetchProductDetail(productId: string) {
  const [detailResponse, reviews] = await Promise.all([
    fetch(buildCatalogUrl(`/products/${productId}/`)),
    fetchProductReviews(productId),
  ]);
  const { data } = await parseApiResponse<CatalogProductDetail>(detailResponse);
  const product = buildProduct(data, reviews);
  product.rating = reviews.length > 0
    ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1))
    : product.rating;
  product.reviewsCount = reviews.length > 0 ? reviews.length : product.reviewsCount;
  return product;
}
