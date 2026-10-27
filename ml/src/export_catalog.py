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
    """Select up to max_per_class images prioritizing hard, then medium, then easy."""
    selected_ids: Set[str] = set()

    for c in CLASSES:
        cdf = df[df["true_class"] == c].copy()
        if len(cdf) <= max_per_class:
            selected_ids.update(cdf["image_id"].tolist())
            continue

        class_selected = []
        # 1. Hard images
        hard_ids = cdf[cdf["bucket"] == "hard"]["image_id"].tolist()
        class_selected.extend(hard_ids[:max_per_class])

        # 2. Medium images
        remaining = max_per_class - len(class_selected)
        if remaining > 0:
            med_ids = cdf[cdf["bucket"] == "medium"]["image_id"].tolist()
            class_selected.extend(med_ids[:remaining])

        # 3. Easy images
        remaining = max_per_class - len(class_selected)
        if remaining > 0:
            easy_df = cdf[cdf["bucket"] == "easy"]
            sample_count = min(remaining, len(easy_df))
            easy_ids = easy_df.sample(n=sample_count, random_state=seed)["image_id"].tolist()
            class_selected.extend(easy_ids)

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
) -> Dict[str, int]:
    """Build app catalog folder, write catalog.json, and zip archive."""
    df = pd.read_csv(difficulty_df_path)
    selected_ids = select_catalog_images(df, max_per_class=max_per_class, seed=seed)

    catalog_images_dir = catalog_dir / "images"
    catalog_images_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    catalog_records = []
    class_counts: Dict[str, int] = {c: 0 for c in CLASSES}

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
        class_counts[c] += 1
        catalog_records.append(
            {
                "imageId": img_id,
                "filename": f"{img_id}.jpg",
                "class": c,
                "source": str(row["source"]),
                "difficulty": float(row["difficulty"]),
                "bucket": str(row["bucket"]),
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
    print(f"Catalog counts: {class_counts}")
    return class_counts


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
