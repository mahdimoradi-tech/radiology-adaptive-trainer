"""Export full difficulty.json metadata artifact for the application."""

import argparse
import json
from pathlib import Path

import pandas as pd


def export_difficulty_json(
    difficulty_df_path: Path,
    catalog_json_path: Path,
    output_path: Path,
) -> None:
    """Export metadata for all images to ml/artifacts/difficulty.json."""
    df = pd.read_csv(difficulty_df_path)

    catalog_ids = set()
    if catalog_json_path.is_file():
        with open(catalog_json_path, encoding="utf-8") as f:
            cat_data = json.load(f)
            catalog_ids = {item.get("id") or item.get("imageId") for item in cat_data}

    artifacts = []
    for _, row in df.iterrows():
        img_id = str(row["image_id"])
        artifacts.append(
            {
                "id": img_id,
                "imageId": img_id,
                "filename": f"{img_id}.jpg",
                "trueClass": str(row["true_class"]),
                "source": str(row["source"]),
                "fold": int(row["fold"]),
                "probs": {
                    "covid19": float(row["prob_covid19"]),
                    "pneumonia": float(row["prob_pneumonia"]),
                    "normal": float(row["prob_normal"]),
                },
                "pTrue": float(row["p_true"]),
                "difficulty": float(row["difficulty"]),
                "bucket": str(row["bucket"]),
                "confusedWith": str(row["confused_with"]),
                "inCatalog": img_id in catalog_ids,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(artifacts, f, indent=2)

    print(f"Exported {len(artifacts)} image records to {output_path}")


def main() -> None:
    """CLI entry point for difficulty.json export."""
    parser = argparse.ArgumentParser(description="Export difficulty.json metadata")
    parser.add_argument("--difficulty-df", type=str, default="../data/interim/difficulty_df.csv")
    parser.add_argument("--catalog-json", type=str, default="../ml/artifacts/catalog.json")
    parser.add_argument("--output", type=str, default="../ml/artifacts/difficulty.json")
    args = parser.parse_args()

    export_difficulty_json(
        difficulty_df_path=Path(args.difficulty_df).resolve(),
        catalog_json_path=Path(args.catalog_json).resolve(),
        output_path=Path(args.output).resolve(),
    )


if __name__ == "__main__":
    main()
