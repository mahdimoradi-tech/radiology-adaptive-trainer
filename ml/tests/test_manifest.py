"""Unit tests for build_manifest with synthetic data."""

from pathlib import Path

from PIL import Image

from build_manifest import build_manifest, compute_sha256, is_valid_image


def test_compute_sha256_and_validation(tmp_path: Path):
    """Test SHA-256 calculation and image validation."""
    valid_img = tmp_path / "valid.png"
    img = Image.new("RGB", (64, 64), color="blue")
    img.save(valid_img)

    assert is_valid_image(valid_img) is True
    sha = compute_sha256(valid_img)
    assert len(sha) == 64

    corrupt_file = tmp_path / "corrupt.png"
    corrupt_file.write_text("not an image binary")
    assert is_valid_image(corrupt_file) is False


def test_build_manifest_synthetic(tmp_path: Path):
    """Test manifest building with synthetic folder structures and deduplication."""
    raw_dir = tmp_path / "raw"
    kermany_norm = raw_dir / "kermany" / "chest_xray" / "train" / "NORMAL"
    kermany_pneu = raw_dir / "kermany" / "chest_xray" / "train" / "PNEUMONIA"
    cohen_covid = raw_dir / "cohen" / "CovidDataset" / "Train" / "Covid"

    kermany_norm.mkdir(parents=True)
    kermany_pneu.mkdir(parents=True)
    cohen_covid.mkdir(parents=True)

    # 1. Normal image
    img1 = Image.new("L", (32, 32), color=100)
    img1.save(kermany_norm / "norm1.jpeg")

    # 2. Duplicate of normal image in another folder
    img1.save(kermany_norm / "norm1_duplicate.jpeg")

    # 3. Pneumonia image
    img2 = Image.new("L", (32, 32), color=150)
    img2.save(kermany_pneu / "pneu1.jpeg")

    # 4. Covid image
    img3 = Image.new("L", (32, 32), color=200)
    img3.save(cohen_covid / "covid1.jpeg")

    out_csv = tmp_path / "manifest.csv"
    report_md = tmp_path / "report.md"

    df, stats = build_manifest(raw_dir, out_csv, report_md)

    assert stats["total_scanned"] == 4
    assert stats["clean_count"] == 3
    assert stats["duplicate_count"] == 1
    assert stats["unreadable_count"] == 0

    assert set(df["label"].unique()) == {"normal", "pneumonia", "covid19"}
    assert set(df.columns) == {"image_id", "path", "source", "label", "sha256"}
    assert out_csv.is_file()
    assert report_md.is_file()


def test_build_manifest_limit(tmp_path: Path):
    """Test limit parameter."""
    raw_dir = tmp_path / "raw"
    kermany_norm = raw_dir / "kermany" / "chest_xray" / "train" / "NORMAL"
    kermany_norm.mkdir(parents=True)

    for i in range(5):
        img = Image.new("L", (16, 16), color=i * 20)
        img.save(kermany_norm / f"img_{i}.png")

    out_csv = tmp_path / "manifest.csv"
    df, stats = build_manifest(raw_dir, out_csv, limit=2)

    assert len(df) == 2
    assert stats["total_scanned"] == 5
