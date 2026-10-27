"""Preprocess chest X-ray images for model feature extraction and web/VLM serving."""

import argparse
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd
import torch
import torchvision.transforms as T
from PIL import Image
from tqdm import tqdm


def get_model_transform() -> T.Compose:
    """Return standard ImageNet transform for DenseNet-121 model input (224x224 RGB)."""
    return T.Compose(
        [
            T.Resize((224, 224), interpolation=T.InterpolationMode.BILINEAR),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def create_web_image(
    src_path: Path,
    dest_path: Path,
    max_side: int = 768,
    quality: int = 90,
) -> bool:
    """Resize image so max side is max_side (preserving aspect ratio) and save as JPEG."""
    if dest_path.exists():
        return True

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(src_path) as img:
            rgb_img = img.convert("RGB")
            # Preserve aspect ratio with max side = max_side
            rgb_img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            rgb_img.save(dest_path, "JPEG", quality=quality, optimize=True)
        return True
    except Exception as e:
        print(f"Error preprocessing {src_path}: {e}")
        return False


def preprocess_manifest(
    manifest_path: Path,
    web_dir: Path,
    limit: Optional[int] = None,
    max_side: int = 768,
    quality: int = 90,
) -> Tuple[int, int]:
    """Process all images in manifest into web directory."""
    df = pd.read_csv(manifest_path)
    if limit is not None and limit > 0:
        df = df.iloc[:limit]

    web_dir.mkdir(parents=True, exist_ok=True)
    success = 0
    failed = 0

    print(f"Preprocessing {len(df)} images into {web_dir} (max side: {max_side}px)...")
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Preprocessing"):
        src = Path(row["path"])
        dest = web_dir / f"{row['image_id']}.jpg"
        if create_web_image(src, dest, max_side=max_side, quality=quality):
            success += 1
        else:
            failed += 1

    return success, failed


def preprocess_for_model(img_path: Path) -> torch.Tensor:
    """Load an image and return preprocessed 3x224x224 PyTorch tensor."""
    with Image.open(img_path) as img:
        rgb_img = img.convert("RGB")
        transform = get_model_transform()
        tensor: torch.Tensor = transform(rgb_img)
        return tensor


def main() -> None:
    """CLI entry point for image preprocessing."""
    parser = argparse.ArgumentParser(description="Preprocess dataset images for web and model")
    parser.add_argument(
        "--manifest",
        type=str,
        default="../data/interim/manifest.csv",
        help="Path to manifest CSV",
    )
    parser.add_argument(
        "--web-dir",
        type=str,
        default="../data/processed/web",
        help="Destination directory for web-ready images",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of images to process (dev mode)",
    )
    parser.add_argument(
        "--max-side",
        type=int,
        default=768,
        help="Maximum width or height for web images",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=90,
        help="JPEG quality (1-100)",
    )
    args = parser.parse_args()

    manifest_file = Path(args.manifest).resolve()
    target_web_dir = Path(args.web_dir).resolve()

    if not manifest_file.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_file}")

    success, failed = preprocess_manifest(
        manifest_file,
        target_web_dir,
        limit=args.limit,
        max_side=args.max_side,
        quality=args.quality,
    )
    print(f"Preprocessing complete: {success} succeeded, {failed} failed.")


if __name__ == "__main__":
    main()
