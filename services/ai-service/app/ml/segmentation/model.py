"""
KMeans customer segmentation model with silhouette score optimization.

Computes RFM (Recency, Frequency, Monetary) features from user interaction
data and clusters customers into 3-8 segments using KMeans. The optimal
number of clusters is determined by maximizing the silhouette score.

Segment names are assigned based on RFM centroid characteristics.
"""

import logging
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Cluster count search range
MIN_CLUSTERS = 3
MAX_CLUSTERS = 8

# Segment naming thresholds (applied to normalized centroid values)
SEGMENT_NAMES = [
    "High-Value Loyal",
    "Frequent Buyer",
    "Big Spender",
    "At-Risk",
    "New Customer",
    "Occasional Shopper",
    "Dormant",
    "Low-Value",
]


@dataclass
class RFMFeatures:
    """RFM feature values for a single customer."""

    user_id: str
    recency_days: int
    frequency: int
    monetary: float


@dataclass
class SegmentAssignment:
    """Segment assignment result for a single customer."""

    user_id: str
    segment_id: int
    segment_name: str
    recency_days: int
    frequency: int
    monetary: float


@dataclass
class SegmentationResult:
    """Complete result of a segmentation run."""

    assignments: list[SegmentAssignment]
    num_customers: int
    num_clusters: int
    silhouette_score_value: float


def compute_rfm_features(
    interactions: list[dict],
    reference_date: datetime | None = None,
) -> list[RFMFeatures]:
    """
    Compute RFM features from user interaction (purchase) data.

    Args:
        interactions: List of dicts with keys: user_id, timestamp, monetary_value.
            Each dict represents a purchase event.
        reference_date: The date to compute recency from. Defaults to now.

    Returns:
        List of RFMFeatures, one per unique customer.
    """
    if reference_date is None:
        reference_date = datetime.utcnow()

    # Group interactions by user
    user_data: dict[str, list[dict]] = {}
    for interaction in interactions:
        uid = str(interaction["user_id"])
        if uid not in user_data:
            user_data[uid] = []
        user_data[uid].append(interaction)

    rfm_list: list[RFMFeatures] = []
    for uid, events in user_data.items():
        # Recency: days since last purchase
        timestamps = [e["timestamp"] for e in events]
        last_purchase = max(timestamps)
        recency_days = (reference_date - last_purchase).days

        # Frequency: total number of orders
        frequency = len(events)

        # Monetary: total spend
        monetary = sum(float(e.get("monetary_value", 0)) for e in events)

        rfm_list.append(
            RFMFeatures(
                user_id=uid,
                recency_days=max(0, recency_days),
                frequency=frequency,
                monetary=round(monetary, 2),
            )
        )

    return rfm_list


def run_kmeans_segmentation(rfm_features: list[RFMFeatures]) -> SegmentationResult:
    """
    Run KMeans clustering on RFM features with silhouette score optimization.

    Tries cluster counts from 3 to 8 and selects the one with the
    highest silhouette score.

    Args:
        rfm_features: List of RFM features for all customers.

    Returns:
        SegmentationResult with assignments, cluster count, and silhouette score.
    """
    # Build feature matrix
    X = np.array(
        [[f.recency_days, f.frequency, f.monetary] for f in rfm_features],
        dtype=np.float64,
    )

    # Standardize features for KMeans
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Determine max possible clusters (can't exceed sample count)
    max_k = min(MAX_CLUSTERS, len(rfm_features) - 1)
    min_k = MIN_CLUSTERS

    if max_k < min_k:
        # If we have very few customers, use minimum possible
        max_k = min_k = min(MIN_CLUSTERS, len(rfm_features) - 1)

    # Search for optimal cluster count
    best_score = -1.0
    best_k = min_k
    best_labels = None

    for k in range(min_k, max_k + 1):
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
        labels = kmeans.fit_predict(X_scaled)

        score = silhouette_score(X_scaled, labels)
        logger.info(
            "segmentation_kmeans_trial",
            extra={"k": k, "silhouette_score": round(score, 4)},
        )

        if score > best_score:
            best_score = score
            best_k = k
            best_labels = labels

    logger.info(
        "segmentation_optimal_k",
        extra={"optimal_k": best_k, "silhouette_score": round(best_score, 4)},
    )

    # Assign descriptive segment names based on cluster centroids
    segment_names = _assign_segment_names(X, best_labels, best_k)

    # Build assignments
    assignments: list[SegmentAssignment] = []
    for i, rfm in enumerate(rfm_features):
        cluster_id = int(best_labels[i])
        assignments.append(
            SegmentAssignment(
                user_id=rfm.user_id,
                segment_id=cluster_id,
                segment_name=segment_names[cluster_id],
                recency_days=rfm.recency_days,
                frequency=rfm.frequency,
                monetary=rfm.monetary,
            )
        )

    return SegmentationResult(
        assignments=assignments,
        num_customers=len(rfm_features),
        num_clusters=best_k,
        silhouette_score_value=round(best_score, 4),
    )


def _assign_segment_names(
    X: np.ndarray, labels: np.ndarray, n_clusters: int
) -> dict[int, str]:
    """
    Assign descriptive segment names based on RFM centroid characteristics.

    Naming logic:
    - Low recency + High frequency + High monetary → "High-Value Loyal"
    - Low recency + High frequency + Low monetary → "Frequent Buyer"
    - Low recency + Low frequency + High monetary → "Big Spender"
    - High recency + High frequency + High monetary → "At-Risk"
    - Low recency + Low frequency + Low monetary → "New Customer"
    - Medium recency + Medium frequency → "Occasional Shopper"
    - High recency + Low frequency + Low monetary → "Dormant"
    - Fallback → "Low-Value"

    Args:
        X: Original (non-scaled) feature matrix [recency, frequency, monetary].
        labels: Cluster labels for each sample.
        n_clusters: Number of clusters.

    Returns:
        Dict mapping cluster_id to segment name.
    """
    # Compute centroids in original feature space
    centroids = np.zeros((n_clusters, 3))
    for k in range(n_clusters):
        mask = labels == k
        if mask.sum() > 0:
            centroids[k] = X[mask].mean(axis=0)

    # Compute global medians for thresholding
    median_recency = np.median(X[:, 0])
    median_frequency = np.median(X[:, 1])
    median_monetary = np.median(X[:, 2])

    # Score each cluster and assign names
    used_names: set[str] = set()
    segment_names: dict[int, str] = {}

    # Sort clusters by a composite score to assign best names first
    # Priority: high monetary + high frequency + low recency = best customers
    cluster_scores = []
    for k in range(n_clusters):
        r, f, m = centroids[k]
        # Higher is better: low recency, high frequency, high monetary
        score = -r + f * 10 + m
        cluster_scores.append((score, k))

    cluster_scores.sort(reverse=True)

    for _, k in cluster_scores:
        r, f, m = centroids[k]

        low_recency = r <= median_recency
        high_frequency = f > median_frequency
        high_monetary = m > median_monetary

        name = _pick_segment_name(
            low_recency, high_frequency, high_monetary, used_names
        )
        used_names.add(name)
        segment_names[k] = name

    return segment_names


def _pick_segment_name(
    low_recency: bool,
    high_frequency: bool,
    high_monetary: bool,
    used_names: set[str],
) -> str:
    """Pick the best available segment name based on RFM characteristics."""
    candidates: list[str] = []

    if low_recency and high_frequency and high_monetary:
        candidates = ["High-Value Loyal", "Frequent Buyer", "Big Spender"]
    elif low_recency and high_frequency and not high_monetary:
        candidates = ["Frequent Buyer", "Occasional Shopper", "New Customer"]
    elif low_recency and not high_frequency and high_monetary:
        candidates = ["Big Spender", "New Customer", "Occasional Shopper"]
    elif not low_recency and high_frequency and high_monetary:
        candidates = ["At-Risk", "High-Value Loyal", "Frequent Buyer"]
    elif low_recency and not high_frequency and not high_monetary:
        candidates = ["New Customer", "Occasional Shopper", "Low-Value"]
    elif not low_recency and high_frequency and not high_monetary:
        candidates = ["At-Risk", "Occasional Shopper", "Dormant"]
    elif not low_recency and not high_frequency and high_monetary:
        candidates = ["At-Risk", "Big Spender", "Dormant"]
    else:
        # High recency, low frequency, low monetary
        candidates = ["Dormant", "Low-Value", "At-Risk"]

    for name in candidates:
        if name not in used_names:
            return name

    # Fallback: use any unused name from the global list
    for name in SEGMENT_NAMES:
        if name not in used_names:
            return name

    # Last resort: append cluster number
    return f"Segment {len(used_names) + 1}"
