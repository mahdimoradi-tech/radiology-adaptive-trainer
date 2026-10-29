"""Consistency tests verifying ml/artifacts/difficulty.json against OOF predictions."""

import json
from pathlib import Path

import numpy as np
import pytest

DIFFICULTY_JSON_PATH = Path(__file__).resolve().parent.parent / "artifacts/difficulty.json"
OOF_PROBS_PATH = Path(__file__).resolve().parent.parent.parent / "data/interim/oof_probs.npy"

CLASS_ORDER = ["covid19", "pneumonia", "normal"]
EXPECTED_CLASS_COUNTS = {"covid19": 177, "pneumonia": 4245, "normal": 1582}
REPORTED_OOF_ACCURACY = 0.9524


@pytest.fixture(scope="module")
def difficulty_data():
    """Load the committed difficulty.json metadata artifact."""
    assert DIFFICULTY_JSON_PATH.is_file(), f"Missing artifact: {DIFFICULTY_JSON_PATH}"
    with open(DIFFICULTY_JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list)
    return data


def test_difficulty_json_id_uniqueness_and_folds(difficulty_data):
    """Every entry has a valid fold id in 0..4 and each image appears exactly once."""
    assert len(difficulty_data) == 6004
    ids = set()
    for row in difficulty_data:
        image_id = row["id"]
        assert image_id not in ids, f"Duplicate image ID found: {image_id}"
        ids.add(image_id)
        assert row["fold"] in {0, 1, 2, 3, 4}, f"Invalid fold {row['fold']} for {image_id}"


def test_difficulty_json_class_counts(difficulty_data):
    """Class counts must equal the manifest (covid19: 177, pneumonia: 4245, normal: 1582)."""
    counts = {c: 0 for c in CLASS_ORDER}
    for row in difficulty_data:
        true_class = row["trueClass"]
        assert true_class in counts, f"Unknown class: {true_class}"
        counts[true_class] += 1
    assert counts == EXPECTED_CLASS_COUNTS


def test_difficulty_json_formulas(difficulty_data):
    """For each entry: pTrue == probs[trueClass] and difficulty == round(1 - pTrue, 4)."""
    for row in difficulty_data:
        true_class = row["trueClass"]
        probs = row["probs"]
        p_true = row["pTrue"]
        difficulty = row["difficulty"]

        # pTrue check (tolerance 1e-4)
        assert abs(p_true - probs[true_class]) < 1e-4, (
            f"pTrue mismatch for {row['id']}: pTrue={p_true}, prob={probs[true_class]}"
        )

        # difficulty formula check (tolerance 1e-4)
        expected_diff = round(1.0 - p_true, 4)
        assert abs(difficulty - expected_diff) < 1e-4, (
            f"Difficulty mismatch for {row['id']}: "
            f"difficulty={difficulty}, expected={expected_diff}"
        )


def test_difficulty_json_oof_accuracy(difficulty_data):
    """Accuracy computed as argmax(probs) == trueClass equals report OOF accuracy within 0.01%."""
    correct = 0
    for row in difficulty_data:
        probs = row["probs"]
        pred_class = max(probs, key=probs.get)
        if pred_class == row["trueClass"]:
            correct += 1

    computed_acc = correct / len(difficulty_data)
    assert abs(computed_acc - REPORTED_OOF_ACCURACY) <= 0.0001, (
        f"Computed accuracy {computed_acc:.6f} differs from reported {REPORTED_OOF_ACCURACY}"
    )


def test_difficulty_json_confused_with(difficulty_data):
    """confusedWith != trueClass and has maximal probability among non-true classes."""
    for row in difficulty_data:
        true_class = row["trueClass"]
        confused_with = row["confusedWith"]
        probs = row["probs"]

        # Cannot be confused with true class
        assert confused_with != true_class, f"confusedWith equals trueClass for image {row['id']}"

        # Must be a valid class
        assert confused_with in CLASS_ORDER, f"Invalid confusedWith {confused_with}"

        # Must be maximal among alternative classes (within floating-point rounding tolerance 1e-4)
        other_classes = [c for c in CLASS_ORDER if c != true_class]
        max_other_prob = max(probs[c] for c in other_classes)
        assert max_other_prob - probs[confused_with] <= 1e-4, (
            f"confusedWith {confused_with} ({probs[confused_with]}) "
            f"is not maximal among {other_classes}"
        )


def test_difficulty_json_aligns_with_raw_oof_predictions(difficulty_data):
    """If local raw oof_probs.npy exists, verify 100% exact alignment with model predictions."""
    if not OOF_PROBS_PATH.is_file():
        pytest.skip("Local raw oof_probs.npy not available; skipped raw alignment check.")

    raw_oof = np.load(OOF_PROBS_PATH)
    assert len(raw_oof) == len(difficulty_data)
    class_to_idx = {c: i for i, c in enumerate(CLASS_ORDER)}

    for i, row in enumerate(difficulty_data):
        true_idx = class_to_idx[row["trueClass"]]
        raw_probs = raw_oof[i]

        # Check raw p_true alignment
        assert abs(float(raw_probs[true_idx]) - row["pTrue"]) < 1e-3

        # Check raw argmax confusedWith alignment
        wrong_indices = [idx for idx in range(len(CLASS_ORDER)) if idx != true_idx]
        best_wrong_idx = wrong_indices[int(np.argmax([raw_probs[idx] for idx in wrong_indices]))]
        expected_confused = CLASS_ORDER[best_wrong_idx]
        assert row["confusedWith"] == expected_confused, (
            f"Mismatch at index {i} ({row['id']}): "
            f"got {row['confusedWith']}, expected {expected_confused}"
        )
