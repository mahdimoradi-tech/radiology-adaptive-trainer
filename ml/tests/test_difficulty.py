"""Unit tests for difficulty, bucket, and confusion pair computations."""

import numpy as np
import pandas as pd
import pytest

from compute_difficulty import (
    assign_quantile_buckets,
    compute_all_difficulties,
    compute_sample_difficulty,
)


def test_compute_sample_difficulty_values():
    """Test mathematical formulas for d = 1 - p(true) and bucket thresholds."""
    # COVID-19 with high confidence: easy
    probs_easy = np.array([0.90, 0.08, 0.02])
    p_true, d, bucket, confused = compute_sample_difficulty("covid19", probs_easy)
    assert p_true == pytest.approx(0.90)
    assert d == pytest.approx(0.10)
    assert bucket == "easy"
    assert confused == "pneumonia"

    # Pneumonia with medium confidence: medium
    probs_med = np.array([0.25, 0.55, 0.20])
    p_true, d, bucket, confused = compute_sample_difficulty("pneumonia", probs_med)
    assert p_true == pytest.approx(0.55)
    assert d == pytest.approx(0.45)
    assert bucket == "medium"
    assert confused == "covid19"

    # Normal with low confidence (misclassified as covid19): hard
    probs_hard = np.array([0.70, 0.10, 0.20])
    p_true, d, bucket, confused = compute_sample_difficulty("normal", probs_hard)
    assert p_true == pytest.approx(0.20)
    assert d == pytest.approx(0.80)
    assert bucket == "hard"
    assert confused == "covid19"


def test_assign_quantile_buckets():
    """Test tertile bucket assignment within classes."""
    data = []
    # 6 samples of covid19 with difficulties 0.0, 0.1, 0.2, 0.3, 0.4, 0.5
    for i in range(6):
        data.append(
            {
                "image_id": f"img_{i}",
                "true_class": "covid19",
                "difficulty": float(i * 0.1),
            }
        )

    df = pd.DataFrame(data)
    qdf = assign_quantile_buckets(df)

    assert (qdf["bucket"] == "easy").sum() == 2
    assert (qdf["bucket"] == "medium").sum() == 2
    assert (qdf["bucket"] == "hard").sum() == 2


def test_compute_all_difficulties_table():
    """Test full table computation from synthetic arrays."""
    ids = np.array(["id_1", "id_2"], dtype=object)
    labels = np.array(["covid19", "normal"], dtype=object)
    oof_probs = np.array(
        [
            [0.85, 0.10, 0.05],
            [0.15, 0.35, 0.50],
        ]
    )
    folds = np.array([0, 1])
    manifest_df = pd.DataFrame(
        [
            {"image_id": "id_1", "path": "path/to/img1.png", "source": "cohen"},
            {"image_id": "id_2", "path": "path/to/img2.png", "source": "kermany"},
        ]
    )

    df = compute_all_difficulties(ids, labels, oof_probs, folds, manifest_df, strategy="paper")

    assert len(df) == 2
    assert "difficulty" in df.columns
    assert "bucket" in df.columns
    assert "confused_with" in df.columns
    assert df.loc[0, "difficulty"] == pytest.approx(0.15)
    assert df.loc[0, "bucket"] == "easy"
    assert df.loc[1, "difficulty"] == pytest.approx(0.50)
    assert df.loc[1, "bucket"] == "medium"
