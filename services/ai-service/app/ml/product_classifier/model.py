"""
Product classification model loading and inference.

Supports two modes:
1. ML-based (XGBoost/LightGBM): Uses a trained model with TF-IDF features
   from product title, description, brand, and attributes. Loaded lazily
   on first request.
2. Rule-based fallback: Keyword matching to predefined categories when the
   trained model file is not available. Suitable for demo/development.
"""

import logging
import os
import re
import uuid
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MODEL_VERSION = "product-classifier-v1"


# Predefined category mappings for rule-based fallback
CATEGORY_RULES: dict[str, dict] = {
    "smartphones": {
        "keywords": [
            "phone", "smartphone", "iphone", "samsung galaxy", "android",
            "mobile", "cellular", "5g phone", "pixel",
        ],
        "category_label": "Smartphones",
    },
    "laptops": {
        "keywords": [
            "laptop", "notebook", "macbook", "chromebook", "ultrabook",
            "thinkpad", "gaming laptop",
        ],
        "category_label": "Laptops",
    },
    "tablets": {
        "keywords": [
            "tablet", "ipad", "galaxy tab", "surface pro", "e-reader",
            "kindle",
        ],
        "category_label": "Tablets",
    },
    "headphones": {
        "keywords": [
            "headphone", "earphone", "earbud", "airpod", "headset",
            "earpiece", "noise cancelling", "wireless earbuds",
        ],
        "category_label": "Headphones & Audio",
    },
    "cameras": {
        "keywords": [
            "camera", "dslr", "mirrorless", "webcam", "gopro",
            "camcorder", "lens", "photography",
        ],
        "category_label": "Cameras",
    },
    "gaming": {
        "keywords": [
            "gaming", "console", "playstation", "xbox", "nintendo",
            "controller", "joystick", "vr headset", "game",
        ],
        "category_label": "Gaming",
    },
    "accessories": {
        "keywords": [
            "case", "charger", "cable", "adapter", "mount", "stand",
            "screen protector", "power bank", "usb", "hub", "dock",
        ],
        "category_label": "Accessories",
    },
    "wearables": {
        "keywords": [
            "watch", "smartwatch", "fitness tracker", "band", "wearable",
            "apple watch", "garmin", "fitbit",
        ],
        "category_label": "Wearables",
    },
    "monitors": {
        "keywords": [
            "monitor", "display", "screen", "4k", "ultrawide",
            "curved monitor", "gaming monitor",
        ],
        "category_label": "Monitors & Displays",
    },
    "storage": {
        "keywords": [
            "ssd", "hard drive", "hdd", "usb drive", "flash drive",
            "memory card", "sd card", "external storage", "nas",
        ],
        "category_label": "Storage",
    },
    "networking": {
        "keywords": [
            "router", "modem", "wifi", "ethernet", "switch", "mesh",
            "access point", "network",
        ],
        "category_label": "Networking",
    },
    "computers": {
        "keywords": [
            "desktop", "pc", "computer", "workstation", "mini pc",
            "all-in-one", "tower", "imac",
        ],
        "category_label": "Computers",
    },
}

# Default category ID mapping (deterministic UUIDs for rule-based fallback)
CATEGORY_ID_MAP: dict[str, str] = {
    category_key: str(uuid.uuid5(uuid.NAMESPACE_DNS, f"techshop.category.{category_key}"))
    for category_key in CATEGORY_RULES
}


@dataclass
class ClassificationResult:
    """Result of product classification inference."""

    predicted_category_label: str
    category_id: str
    confidence_score: float
    model_version: str


class ProductClassifierModel:
    """
    Product classification model with lazy loading and rule-based fallback.

    Attempts to load a trained XGBoost/LightGBM model on first inference.
    Falls back to keyword-based classification if the model file is unavailable.
    """

    def __init__(self) -> None:
        self._model = None
        self._vectorizer = None
        self._label_encoder = None
        self._model_loaded = False
        self._load_attempted = False

    def _try_load_model(self) -> bool:
        """
        Attempt to load the trained classification model and TF-IDF vectorizer.

        Returns True if successful, False otherwise.
        """
        if self._load_attempted:
            return self._model_loaded

        self._load_attempted = True
        settings = get_settings()
        model_path = settings.classification_model_path

        try:
            import joblib

            model_file = os.path.join(model_path, "classifier.joblib")
            vectorizer_file = os.path.join(model_path, "tfidf_vectorizer.joblib")
            label_encoder_file = os.path.join(model_path, "label_encoder.joblib")

            if not os.path.exists(model_file):
                logger.warning(
                    "classification_model_not_found",
                    extra={"model_path": model_file},
                )
                return False

            if not os.path.exists(vectorizer_file):
                logger.warning(
                    "tfidf_vectorizer_not_found",
                    extra={"vectorizer_path": vectorizer_file},
                )
                return False

            self._model = joblib.load(model_file)
            self._vectorizer = joblib.load(vectorizer_file)

            if os.path.exists(label_encoder_file):
                self._label_encoder = joblib.load(label_encoder_file)

            self._model_loaded = True
            logger.info(
                "classification_model_loaded",
                extra={"model_path": model_path},
            )
            return True

        except Exception as e:
            logger.warning(
                "classification_model_load_failed_using_fallback",
                extra={"error": str(e)},
            )
            self._model_loaded = False
            return False

    def predict(
        self,
        title: str,
        description: str,
        brand: str,
        attributes: dict | None = None,
    ) -> ClassificationResult:
        """
        Run classification inference on the given product data.

        Tries the trained ML model first; falls back to rule-based
        classification if the model is not available.
        """
        if self._try_load_model() and self._model is not None:
            return self._predict_ml(title, description, brand, attributes)
        return self._predict_rule_based(title, description, brand, attributes)

    def _build_feature_text(
        self,
        title: str,
        description: str,
        brand: str,
        attributes: dict | None = None,
    ) -> str:
        """
        Combine product fields into a single text for TF-IDF feature extraction.

        Concatenates title, description, brand, and flattened attributes
        into a single string for vectorization.
        """
        parts = []
        if title:
            parts.append(title)
        if description:
            parts.append(description)
        if brand:
            parts.append(brand)
        if attributes:
            # Flatten attributes dict into key-value strings
            for key, value in attributes.items():
                if isinstance(value, list):
                    parts.append(f"{key}: {', '.join(str(v) for v in value)}")
                else:
                    parts.append(f"{key}: {value}")

        return " ".join(parts)

    def _predict_ml(
        self,
        title: str,
        description: str,
        brand: str,
        attributes: dict | None = None,
    ) -> ClassificationResult:
        """Run inference using the loaded ML model with TF-IDF features."""
        feature_text = self._build_feature_text(title, description, brand, attributes)

        # Transform text to TF-IDF features
        tfidf_features = self._vectorizer.transform([feature_text])

        # Get prediction probabilities
        probabilities = self._model.predict_proba(tfidf_features)[0]
        predicted_class_idx = probabilities.argmax()
        confidence = float(probabilities[predicted_class_idx])

        # Decode label
        if self._label_encoder is not None:
            predicted_label = self._label_encoder.inverse_transform([predicted_class_idx])[0]
        else:
            classes = self._model.classes_
            predicted_label = str(classes[predicted_class_idx])

        # Map to category ID (use deterministic UUID from label)
        category_key = predicted_label.lower().replace(" ", "_").replace("&", "and")
        category_id = CATEGORY_ID_MAP.get(
            category_key,
            str(uuid.uuid5(uuid.NAMESPACE_DNS, f"techshop.category.{category_key}")),
        )

        return ClassificationResult(
            predicted_category_label=predicted_label,
            category_id=category_id,
            confidence_score=round(confidence, 4),
            model_version=MODEL_VERSION,
        )

    def _predict_rule_based(
        self,
        title: str,
        description: str,
        brand: str,
        attributes: dict | None = None,
    ) -> ClassificationResult:
        """
        Rule-based fallback classification using keyword matching.

        Scores each category by counting keyword matches in the combined
        product text. Returns the best-matching category with a confidence
        score proportional to the match strength.
        """
        feature_text = self._build_feature_text(
            title, description, brand, attributes
        ).lower()

        best_category_key: str | None = None
        best_score = 0
        total_keywords_matched = 0

        for category_key, category_info in CATEGORY_RULES.items():
            keywords = category_info["keywords"]
            match_count = sum(
                1 for kw in keywords
                if re.search(rf"\b{re.escape(kw)}\b", feature_text)
            )
            if match_count > best_score:
                best_score = match_count
                best_category_key = category_key
            total_keywords_matched += match_count

        if best_category_key is None or best_score == 0:
            # No keyword matches — assign to generic "Electronics" category
            return ClassificationResult(
                predicted_category_label="Electronics",
                category_id=str(
                    uuid.uuid5(uuid.NAMESPACE_DNS, "techshop.category.electronics")
                ),
                confidence_score=0.3,
                model_version=f"{MODEL_VERSION}-fallback",
            )

        # Calculate confidence based on match strength
        # More matches = higher confidence, capped at 0.85 for rule-based
        category_info = CATEGORY_RULES[best_category_key]
        max_possible = len(category_info["keywords"])
        raw_confidence = min(best_score / max(max_possible * 0.5, 1), 1.0)
        confidence = round(min(raw_confidence * 0.85, 0.85), 4)

        return ClassificationResult(
            predicted_category_label=category_info["category_label"],
            category_id=CATEGORY_ID_MAP[best_category_key],
            confidence_score=confidence,
            model_version=f"{MODEL_VERSION}-fallback",
        )


# Module-level singleton for lazy loading and caching
_model_instance: ProductClassifierModel | None = None


def get_product_classifier_model() -> ProductClassifierModel:
    """Get or create the cached product classifier model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = ProductClassifierModel()
    return _model_instance
