import { parseApiResponse } from "./api";
import { authorizedFetch } from "./auth";
import { AuthSession, Review } from "./types";

const REVIEW_BASE_URL = import.meta.env.VITE_REVIEW_BASE_URL || "/api/reviews";

interface CreatedReviewPayload {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment: string;
  sentiment_label: string | null;
  sentiment_status: string;
  created_at: string;
}

export async function createReview(
  payload: { product_id: string; rating: number; comment: string },
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    REVIEW_BASE_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    session,
    onSessionRefresh,
  );

  const { data } = await parseApiResponse<CreatedReviewPayload>(response);
  return {
    id: data.id,
    author: `Customer ${data.user_id.slice(0, 8)}`,
    rating: data.rating,
    text: data.comment,
    date: new Date(data.created_at).toLocaleDateString("en-CA"),
    userId: data.user_id,
    sentimentLabel: data.sentiment_label,
    sentimentStatus: data.sentiment_status,
  } satisfies Review;
}
