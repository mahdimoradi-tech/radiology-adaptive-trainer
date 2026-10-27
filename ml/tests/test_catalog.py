"""Unit tests for catalog export and bucket diversity."""

import json
from pathlib import Path

import pandas as pd

from export_catalog import export_catalog, select_catalog_images


def test_select_catalog_images_preserves_all_tiers():
    """Verify that catalog selection never starves easy or medium buckets."""
    # Synthetic dataset with 100 hard, 100 medium, 500 easy for a class
    records = []
    for i in range(100):
        records.append({"image_id": f"hard_{i}", "true_class": "pneumonia", "bucket": "hard"})
    for i in range(100):
        records.append({"image_id": f"med_{i}", "true_class": "pneumonia", "bucket": "medium"})
    for i in range(500):
        records.append({"image_id": f"easy_{i}", "true_class": "pneumonia", "bucket": "easy"})

    df = pd.DataFrame(records)
    selected = select_catalog_images(df, max_per_class=300, seed=42)

    assert len(selected) == 300
    sel_df = df[df["image_id"].isin(selected)]

    # All 100 hard and all 100 medium must be present, and 100 easy
    assert (sel_df["bucket"] == "hard").sum() == 100
    assert (sel_df["bucket"] == "medium").sum() == 100
    assert (sel_df["bucket"] == "easy").sum() == 100


def test_export_catalog_schema_and_fields(tmp_path: Path):
    """Verify catalog.json output contains id, imageId, trueClass, and bucket."""
    records = [
        {
            "image_id": "cov_1",
            "source": "cohen",
            "true_class": "covid19",
            "difficulty": 0.05,
            "bucket": "easy",
            "confused_with": "pneumonia",
        },
        {
            "image_id": "pne_1",
            "source": "kermany",
            "true_class": "pneumonia",
            "difficulty": 0.50,
            "bucket": "medium",
            "confused_with": "covid19",
        },
        {
            "image_id": "nor_1",
            "source": "kermany",
            "true_class": "normal",
            "difficulty": 0.85,
            "bucket": "hard",
            "confused_with": "pneumonia",
        },
    ]
    diff_csv = tmp_path / "diff.csv"
    pd.DataFrame(records).to_csv(diff_csv, index=False)

    web_dir = tmp_path / "web"
    web_dir.mkdir()
    for r in records:
        (web_dir / f"{r['image_id']}.jpg").write_text("fake jpeg")

    catalog_dir = tmp_path / "catalog"
    artifacts_dir = tmp_path / "artifacts"
    zip_path = tmp_path / "catalog.zip"

    counts = export_catalog(
        difficulty_df_path=diff_csv,
        web_dir=web_dir,
        catalog_dir=catalog_dir,
        artifacts_dir=artifacts_dir,
        zip_output_path=zip_path,
        max_per_class=500,
    )

    cat_json = artifacts_dir / "catalog.json"
    assert cat_json.is_file()

    with open(cat_json) as f:
        data = json.load(f)

    assert len(data) == 3
    for item in data:
        assert "id" in item
        assert "imageId" in item
        assert "trueClass" in item
        assert "difficulty" in item
        assert "bucket" in item
        assert "confusedWith" in item

    assert counts["covid19"]["easy"] == 1
    assert counts["pneumonia"]["medium"] == 1
    assert counts["normal"]["hard"] == 1
    assert zip_path.is_file()
