"""Unit tests for Out-of-Fold training and fold disjointness."""

import numpy as np
import torch

from train_oof import CLASSES, ClassificationHead, run_oof_training


def test_classification_head_architecture():
    """Test classification head output shape and layer structure."""
    model = ClassificationHead(in_features=1024, num_classes=3, dropout_rate=0.3)
    model.eval()

    dummy_input = torch.randn(4, 1024)
    out = model(dummy_input)
    assert out.shape == (4, 3)


def test_oof_fold_disjointness_and_probabilities():
    """Test that every sample is scored out-of-fold exactly once, and probabilities sum to 1.0."""
    # Synthetic dataset with 3 classes
    n_samples = 30
    features = np.random.randn(n_samples, 1024).astype(np.float32)
    labels = np.array(["covid19"] * 10 + ["pneumonia"] * 10 + ["normal"] * 10, dtype=object)
    ids = np.array([f"img_{i}" for i in range(n_samples)], dtype=object)

    oof_probs, assigned_folds = run_oof_training(
        features=features,
        labels=labels,
        ids=ids,
        n_splits=3,
        seed=42,
        device="cpu",
    )

    # 1. Shape and range
    assert oof_probs.shape == (n_samples, len(CLASSES))
    assert np.all(oof_probs >= 0.0)
    assert np.all(oof_probs <= 1.0)

    # 2. Sum to 1.0 per sample (valid probability distribution)
    prob_sums = np.sum(oof_probs, axis=1)
    np.testing.assert_allclose(prob_sums, 1.0, atol=1e-5)

    # 3. Fold assignment disjointness: every sample is assigned to exactly one fold
    assert len(assigned_folds) == n_samples
    assert set(np.unique(assigned_folds)) == {0, 1, 2}
    for fold in range(3):
        assert np.sum(assigned_folds == fold) == 10
