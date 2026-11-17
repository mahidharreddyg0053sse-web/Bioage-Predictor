"""
Random Forest Phishing URL Classifier Training Script.
Trains a calibrated RandomForestClassifier on extracted URL features,
evaluates held-out test metrics, and persists the model artifact.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

# Allow running directly via `python app/ml/train_model.py`
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.dataset_generator import build_feature_dataframe
from app.ml.feature_extractor import FEATURE_NAMES

DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_FILENAME = "phishguard_rf_model.joblib"
METRICS_FILENAME = "model_metrics.json"


def train_and_save_model(artifacts_dir: Path = DEFAULT_ARTIFACTS_DIR) -> Dict[str, Any]:
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    df = build_feature_dataframe(n_legit=2500, n_phish=2500, seed=42)
    X = df[FEATURE_NAMES].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    base_rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=18,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=1,
    )
    # Fit raw RF to capture feature importances, then calibrate probabilities via CV
    base_rf.fit(X_train, y_train)
    feature_importances = {
        name: round(float(imp), 5)
        for name, imp in sorted(
            zip(FEATURE_NAMES, base_rf.feature_importances_),
            key=lambda x: x[1],
            reverse=True,
        )
    }

    calibrated_clf = CalibratedClassifierCV(
        estimator=RandomForestClassifier(
            n_estimators=200,
            max_depth=18,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
            n_jobs=1,
        ),
        method="sigmoid",
        cv=5,
    )
    calibrated_clf.fit(X_train, y_train)

    y_pred = calibrated_clf.predict(X_test)
    y_prob = calibrated_clf.predict_proba(X_test)[:, 1]

    metrics: Dict[str, Any] = {
        "model_type": "Calibrated RandomForestClassifier (200 trees, Platt sigmoid calibration)",
        "feature_count": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred)), 4),
        "recall": round(float(recall_score(y_test, y_pred)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_prob)), 4),
        "top_features": dict(list(feature_importances.items())[:10]),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    payload = {
        "model": calibrated_clf,
        "feature_names": FEATURE_NAMES,
        "feature_importances": feature_importances,
        "metrics": metrics,
    }

    model_path = artifacts_dir / MODEL_FILENAME
    metrics_path = artifacts_dir / METRICS_FILENAME

    joblib.dump(payload, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return metrics


if __name__ == "__main__":
    print("Training PhishGuard Random Forest Phishing Classifier...")
    result = train_and_save_model()
    print(json.dumps(result, indent=2))
