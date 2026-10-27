"""Export app catalog subset (up to 500 images per class) and create zip package."""

import argparse
import json
import shutil
import zipfile
from pathlib import Path
from typing import Dict, Set

import pandas as pd

CLASSES = ["covid19", "pneumonia", "normal"]
RANDOM_SEED = 42


def select_catalog_images(
    df: pd.DataFrame, max_per_class: int = 500, seed: int = RANDOM_SEED
) -> Set[str]:
    """Select up to max_per_class images ensuring representation across Easy, Medium, and Hard."""
    selected_ids: Set[str] = set()

    for c in CLASSES:
        cdf = df[df["true_class"] == c].copy()
        if len(cdf) <= max_per_class:
            selected_ids.update(cdf["image_id"].tolist())
            continue

        hard_df = cdf[cdf["bucket"] == "hard"]
        med_df = cdf[cdf["bucket"] == "medium"]
        easy_df = cdf[cdf["bucket"] == "easy"]

        n_hard = len(hard_df)
        n_med = len(med_df)
        n_easy = len(easy_df)

        class_selected = []

        # If hard + medium fits within cap, take all hard & medium, fill remainder with easy
        if n_hard + n_med < max_per_class:
            class_selected.extend(hard_df["image_id"].tolist())
            class_selected.extend(med_df["image_id"].tolist())
            remaining = max_per_class - len(class_selected)
            sample_easy = min(remaining, n_easy)
            if sample_easy > 0:
                class_selected.extend(
                    easy_df.sample(n=sample_easy, random_state=seed)["image_id"].tolist()
                )
        else:
            # If hard + medium exceeds cap, ensure balanced representation across all three tiers
            # Reserve at least 25% for easy if available, and split remainder between hard and med
            easy_quota = min(n_easy, max(1, max_per_class // 4))
            if easy_quota > 0:
                class_selected.extend(
                    easy_df.sample(n=easy_quota, random_state=seed)["image_id"].tolist()
                )
            rem_for_hard_med = max_per_class - len(class_selected)
            hard_quota = min(n_hard, rem_for_hard_med // 2)
            med_quota = min(n_med, rem_for_hard_med - hard_quota)
            if hard_quota > 0:
                class_selected.extend(
                    hard_df.sample(n=hard_quota, random_state=seed)["image_id"].tolist()
                )
            if med_quota > 0:
                class_selected.extend(
                    med_df.sample(n=med_quota, random_state=seed)["image_id"].tolist()
                )

            leftover_needed = max_per_class - len(class_selected)
            if leftover_needed > 0:
                remaining_candidates = cdf[~cdf["image_id"].isin(class_selected)]
                class_selected.extend(
                    remaining_candidates.sample(
                        n=min(leftover_needed, len(remaining_candidates)), random_state=seed
                    )["image_id"].tolist()
                )

        selected_ids.update(class_selected)

    return selected_ids


def export_catalog(
    difficulty_df_path: Path,
    web_dir: Path,
    catalog_dir: Path,
    artifacts_dir: Path,
    zip_output_path: Path,
    max_per_class: int = 500,
    seed: int = RANDOM_SEED,
) -> Dict[str, Dict[str, int]]:
    """Build app catalog folder, write catalog.json, and zip archive."""
    df = pd.read_csv(difficulty_df_path)
    selected_ids = select_catalog_images(df, max_per_class=max_per_class, seed=seed)

    catalog_images_dir = catalog_dir / "images"
    catalog_images_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    catalog_records = []
    class_bucket_counts: Dict[str, Dict[str, int]] = {
        c: {"easy": 0, "medium": 0, "hard": 0} for c in CLASSES
    }

    print(f"Exporting {len(selected_ids)} catalog images...")
    for _, row in df.iterrows():
        img_id = str(row["image_id"])
        if img_id not in selected_ids:
            continue

        src_web = web_dir / f"{img_id}.jpg"
        dest_img = catalog_images_dir / f"{img_id}.jpg"

        if src_web.is_file() and not dest_img.is_file():
            shutil.copy2(src_web, dest_img)

        c = str(row["true_class"])
        b = str(row["bucket"])
        class_bucket_counts[c][b] += 1
        catalog_records.append(
            {
                "id": img_id,
                "imageId": img_id,
                "filename": f"{img_id}.jpg",
                "trueClass": c,
                "source": str(row["source"]),
                "difficulty": float(row["difficulty"]),
                "bucket": b,
                "confusedWith": str(row["confused_with"]),
            }
        )

    # Write catalog.json to both catalog_dir and ml/artifacts/
    catalog_json_path = artifacts_dir / "catalog.json"
    with open(catalog_json_path, "w", encoding="utf-8") as f:
        json.dump(catalog_records, f, indent=2)

    with open(catalog_dir / "catalog.json", "w", encoding="utf-8") as f:
        json.dump(catalog_records, f, indent=2)

    # Create zip archive of catalog directory
    zip_output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Creating zip archive at {zip_output_path}...")
    with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as z:
        for file in catalog_dir.rglob("*"):
            if file.is_file():
                arcname = file.relative_to(catalog_dir.parent)
                z.write(file, arcname)

    zip_size_mb = zip_output_path.stat().st_size / (1024 * 1024)
    print(f"Catalog zip created: {zip_output_path} ({zip_size_mb:.2f} MB)")
    print(f"Catalog counts by class and bucket: {class_bucket_counts}")
    return class_bucket_counts


def main() -> None:
    """CLI entry point for catalog export."""
    parser = argparse.ArgumentParser(description="Export web catalog and zip package")
    parser.add_argument("--difficulty-df", type=str, default="../data/interim/difficulty_df.csv")
    parser.add_argument("--web-dir", type=str, default="../data/processed/web")
    parser.add_argument("--catalog-dir", type=str, default="../data/catalog")
    parser.add_argument("--artifacts-dir", type=str, default="../ml/artifacts")
    parser.add_argument("--zip-output", type=str, default="../data/catalog-images.zip")
    parser.add_argument("--max-per-class", type=int, default=500)
    args = parser.parse_args()

    export_catalog(
        difficulty_df_path=Path(args.difficulty_df).resolve(),
        web_dir=Path(args.web_dir).resolve(),
        catalog_dir=Path(args.catalog_dir).resolve(),
        artifacts_dir=Path(args.artifacts_dir).resolve(),
        zip_output_path=Path(args.zip_output).resolve(),
        max_per_class=args.max_per_class,
    )


if __name__ == "__main__":
    main()
