"""Compute difficulty score, buckets, and confusion pairs from out-of-fold probabilities."""

import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

CLASSES: List[str] = ["covid19", "pneumonia", "normal"]
CLASS_TO_IDX: Dict[str, int] = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS: Dict[int, str] = {i: c for i, c in enumerate(CLASSES)}


def compute_sample_difficulty(
    true_class: str,
    probs: np.ndarray,
    easy_threshold: float = 0.34,
    hard_threshold: float = 0.68,
) -> Tuple[float, float, str, str]:
    """Compute (p_true, difficulty, bucket, confused_with) for a single sample."""
    true_idx = CLASS_TO_IDX[true_class]
    p_true = float(probs[true_idx])
    difficulty = float(np.clip(1.0 - p_true, 0.0, 1.0))

    if difficulty < easy_threshold:
        bucket = "easy"
    elif difficulty < hard_threshold:
        bucket = "medium"
    else:
        bucket = "hard"

    wrong_indices = [i for i in range(len(CLASSES)) if i != true_idx]
    wrong_probs = [probs[i] for i in wrong_indices]
    best_wrong_idx = wrong_indices[int(np.argmax(wrong_probs))]
    confused_with = IDX_TO_CLASS[best_wrong_idx]

    return p_true, difficulty, bucket, confused_with


def assign_quantile_buckets(df: pd.DataFrame) -> pd.DataFrame:
    """Assign easy/medium/hard buckets within each class based on difficulty tertiles."""
    df = df.copy()
    bucket_col = pd.Series(index=df.index, dtype=object)

    for c in CLASSES:
        class_mask = df["true_class"] == c
        cdf = df[class_mask]
        n_samples = len(cdf)
        if n_samples == 0:
            continue

        # Rank samples by difficulty ascending
        # In case of ties, maintain deterministic stable ranking by image_id
        sorted_indices = cdf.sort_values(by=["difficulty", "image_id"]).index
        t1 = n_samples // 3
        t2 = 2 * (n_samples // 3)

        bucket_col.loc[sorted_indices[:t1]] = "easy"
        bucket_col.loc[sorted_indices[t1:t2]] = "medium"
        bucket_col.loc[sorted_indices[t2:]] = "hard"

    df["bucket"] = bucket_col
    return df


def compute_all_difficulties(
    ids: np.ndarray,
    labels: np.ndarray,
    oof_probs: np.ndarray,
    folds: np.ndarray,
    manifest_df: pd.DataFrame,
    strategy: str = "quantile",
    easy_threshold: float = 0.34,
    hard_threshold: float = 0.68,
) -> pd.DataFrame:
    """Compute difficulty metrics for all images and return augmented DataFrame."""
    records = []
    manifest_map = manifest_df.set_index("image_id").to_dict(orient="index")

    for i in range(len(ids)):
        img_id = str(ids[i])
        true_class = str(labels[i])
        probs = oof_probs[i]
        fold = int(folds[i])

        p_true, difficulty, bucket, confused_with = compute_sample_difficulty(
            true_class=true_class,
            probs=probs,
            easy_threshold=easy_threshold,
            hard_threshold=hard_threshold,
        )

        source_info = manifest_map.get(img_id, {})
        records.append({
            "image_id": img_id,
            "filename": Path(source_info.get("path", "")).name,
            "source": source_info.get("source", "unknown"),
            "true_class": true_class,
            "fold": fold,
            "prob_covid19": round(float(probs[0]), 4),
            "prob_pneumonia": round(float(probs[1]), 4),
            "prob_normal": round(float(probs[2]), 4),
            "p_true": round(p_true, 4),
            "difficulty": round(difficulty, 4),
            "bucket": bucket,
            "confused_with": confused_with,
        })

    df = pd.DataFrame(records)

    if strategy == "quantile":
        df = assign_quantile_buckets(df)

    # Verification of bucket representation
    for c in CLASSES:
        class_df = df[df["true_class"] == c]
        if len(class_df) > 0:
            for b in ["easy", "medium", "hard"]:
                count = (class_df["bucket"] == b).sum()
                pct = count / len(class_df)
                if pct < 0.05:
                    print(
                        f"Notice: Class '{c}' in bucket '{b}' has only {count} samples "
                        f"({pct * 100:.1f}% < 5%)."
                    )

    return df


def main() -> None:
    """CLI entry point for difficulty computation."""
    parser = argparse.ArgumentParser(
        description="Compute difficulty and buckets from OOF probabilities"
    )
    parser.add_argument(
        "--ids", type=str, default="../data/interim/ids.npy", help="Path to ids.npy"
    )
    parser.add_argument(
        "--labels", type=str, default="../data/interim/labels.npy", help="Path to labels.npy"
    )
    parser.add_argument(
        "--oof-probs",
        type=str,
        default="../data/interim/oof_probs.npy",
        help="Path to oof_probs.npy",
    )
    parser.add_argument(
        "--folds",
        type=str,
        default="../data/interim/assigned_folds.npy",
        help="Path to assigned_folds.npy",
    )
    parser.add_argument(
        "--manifest",
        type=str,
        default="../data/interim/manifest.csv",
        help="Path to manifest.csv",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../data/interim/difficulty_df.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        default="quantile",
        choices=["quantile", "paper"],
        help="Bucket assignment strategy (default: quantile)",
    )
    args = parser.parse_args()

    ids = np.load(args.ids, allow_pickle=True)
    labels = np.load(args.labels, allow_pickle=True)
    oof_probs = np.load(args.oof_probs)
    folds = np.load(args.folds)
    manifest_df = pd.read_csv(args.manifest)

    df = compute_all_difficulties(
        ids, labels, oof_probs, folds, manifest_df, strategy=args.strategy
    )
    out_path = Path(args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"Difficulty computation complete. Saved {len(df)} records to {out_path}")


if __name__ == "__main__":
    main()
