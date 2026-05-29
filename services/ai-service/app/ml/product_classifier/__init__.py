"""
Product classification model module.

Provides XGBoost/LightGBM-based product classification with TF-IDF features
extracted from product title, description, brand, and attributes.
Falls back to rule-based keyword matching when the trained model is unavailable.
"""

from app.ml.product_classifier.model import (
    ClassificationResult,
    ProductClassifierModel,
    get_product_classifier_model,
)

__all__ = [
    "ClassificationResult",
    "ProductClassifierModel",
    "get_product_classifier_model",
]
