"""Unit tests for image preprocessing."""

from pathlib import Path

import pandas as pd
from PIL import Image

from preprocess import create_web_image, preprocess_for_model, preprocess_manifest


def test_create_web_image(tmp_path: Path):
    """Test web image resizing to max dimension while preserving aspect ratio."""
    src_file = tmp_path / "large_input.png"
    # Create large rectangular image (1200 x 600)
    img = Image.new("RGB", (1200, 600), color=(120, 150, 180))
    img.save(src_file)

    dest_file = tmp_path / "output_web.jpg"
    success = create_web_image(src_file, dest_file, max_side=768, quality=90)

    assert success is True
    assert dest_file.exists()

    with Image.open(dest_file) as out_img:
        w, h = out_img.size
        assert max(w, h) == 768
        assert w == 768
        assert h == 384
        assert out_img.format == "JPEG"


def test_preprocess_for_model(tmp_path: Path):
    """Test model input preprocessing producing 3x224x224 tensor."""
    src_file = tmp_path / "test_img.png"
    img = Image.new("L", (300, 400), color=128)
    img.save(src_file)

    tensor = preprocess_for_model(src_file)
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype.is_floating_point


def test_preprocess_manifest(tmp_path: Path):
    """Test batch preprocessing using manifest."""
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    web_dir = tmp_path / "web"

    records = []
    for i in range(3):
        p = raw_dir / f"img_{i}.png"
        Image.new("RGB", (100, 100), color=(i * 30, i * 30, i * 30)).save(p)
        records.append(
            {
                "image_id": f"test_{i}",
                "path": str(p),
                "source": "test",
                "label": "normal",
                "sha256": f"hash_{i}",
            }
        )

    manifest_path = tmp_path / "manifest.csv"
    pd.DataFrame(records).to_csv(manifest_path, index=False)

    success, failed = preprocess_manifest(manifest_path, web_dir)
    assert success == 3
    assert failed == 0

    assert (web_dir / "test_0.jpg").is_file()
    assert (web_dir / "test_1.jpg").is_file()
    assert (web_dir / "test_2.jpg").is_file()
