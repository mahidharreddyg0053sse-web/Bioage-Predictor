"""Runtime ML Predictor for PhishGuard."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List
import joblib
import numpy as np

from app.config import get_settings
from app.ml.feature_extractor import FEATURE_NAMES, extract_url_features, features_to_vector
from app.ml.train_model import MODEL_FILENAME, train_and_save_model


class PhishingMLPredictor:
    """Loads the calibrated Random Forest classifier and runs real-time URL inference."""

    def __init__(self) -> None:
        self._model = None
        self._feature_importances: Dict[str, float] = {}
        self._metrics: Dict[str, Any] = {}

    def ensure_loaded(self) -> None:
        if self._model is not None:
            return
        settings = get_settings()
        artifacts_dir = Path(settings.ml_artifacts_dir)
        model_path = artifacts_dir / MODEL_FILENAME
        if not model_path.exists():
            train_and_save_model(artifacts_dir)
        payload = joblib.load(model_path)
        self._model = payload["model"]
        self._feature_importances = payload.get("feature_importances", {})
        self._metrics = payload.get("metrics", {})

    @property
    def metrics(self) -> Dict[str, Any]:
        self.ensure_loaded()
        return self._metrics

    def predict(self, url: str) -> Dict[str, Any]:
        self.ensure_loaded()
        features, signals = extract_url_features(url)
        vector = np.array([features_to_vector(features)], dtype=float)
        probs = self._model.predict_proba(vector)[0]
        legit_prob = float(probs[0])
        phishing_prob = float(probs[1])

        prediction = "phishing" if phishing_prob >= 0.50 else "legitimate"
        confidence = phishing_prob if prediction == "phishing" else legit_prob

        # Compute top active features for this URL weighted by global importance
        top_contributors: List[Dict[str, Any]] = []
        for feat_name, importance in list(self._feature_importances.items())[:8]:
            top_contributors.append({
                "feature": feat_name,
                "value": features[feat_name],
                "importance": importance,
            })

        return {
            "prediction": prediction,
            "confidence": round(confidence, 4),
            "phishing_probability": round(phishing_prob, 4),
            "legitimate_probability": round(legit_prob, 4),
            "features": features,
            "feature_signals": signals,
            "top_contributors": top_contributors,
            "model_info": {
                "model_type": self._metrics.get("model_type", "Calibrated RandomForestClassifier"),
                "accuracy": self._metrics.get("accuracy"),
                "roc_auc": self._metrics.get("roc_auc"),
                "feature_count": len(FEATURE_NAMES),
            },
        }


predictor = PhishingMLPredictor()
