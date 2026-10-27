"""Extract 1024-dimensional DenseNet-121 features from chest X-ray images."""

import argparse
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm


def get_model_transform() -> T.Compose:
    """Return standard ImageNet transform for DenseNet-121 model input."""
    return T.Compose(
        [
            T.Resize((224, 224), interpolation=T.InterpolationMode.BILINEAR),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


class ChestXrayDataset(Dataset):
    """Dataset for extracting features from images."""

    def __init__(self, image_ids: List[str], paths: List[str], transform: T.Compose):
        self.image_ids = image_ids
        self.paths = paths
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_ids)

    def __getitem__(self, idx: int) -> Tuple[str, torch.Tensor]:
        img_path = Path(self.paths[idx])
        with Image.open(img_path) as img:
            rgb_img = img.convert("RGB")
            tensor = self.transform(rgb_img)
        return self.image_ids[idx], tensor


def build_feature_extractor() -> nn.Module:
    """Create DenseNet-121 feature extractor with pre-trained weights."""
    model = models.densenet121(weights=models.DenseNet121_Weights.DEFAULT)
    model.eval()
    model.classifier = nn.Identity()
    for param in model.parameters():
        param.requires_grad = False
    return model


def extract_features(
    manifest_path: Path,
    output_dir: Path,
    web_dir: Optional[Path] = None,
    batch_size: int = 32,
    limit: Optional[int] = None,
    device: Optional[str] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract 1024-d features for all images in manifest, with resume capability."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    df = pd.read_csv(manifest_path)
    if limit is not None and limit > 0:
        df = df.iloc[:limit].copy()

    output_dir.mkdir(parents=True, exist_ok=True)
    features_path = output_dir / "features.npy"
    ids_path = output_dir / "ids.npy"
    labels_path = output_dir / "labels.npy"

    manifest_ids = df["image_id"].tolist()
    manifest_labels = df["label"].tolist()

    # Check for existing completed extraction
    if features_path.is_file() and ids_path.is_file() and labels_path.is_file():
        existing_ids = np.load(ids_path, allow_pickle=True).tolist()
        if existing_ids == manifest_ids:
            print(f"Features already extracted and complete ({len(existing_ids)} images).")
            return (
                np.load(features_path),
                np.load(ids_path, allow_pickle=True),
                np.load(labels_path, allow_pickle=True),
            )

    # Determine paths: prefer preprocessed web images if available
    img_paths = []
    for _, row in df.iterrows():
        img_id = row["image_id"]
        web_file = web_dir / f"{img_id}.jpg" if web_dir else None
        if web_file and web_file.is_file():
            img_paths.append(str(web_file))
        else:
            img_paths.append(row["path"])

    dataset = ChestXrayDataset(manifest_ids, img_paths, get_model_transform())
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    model = build_feature_extractor().to(device)

    all_features = []
    all_ids = []

    print(f"Extracting DenseNet-121 features on {device.upper()} for {len(dataset)} images...")
    with torch.no_grad():
        for batch_ids, batch_tensors in tqdm(loader, desc="Feature extraction"):
            batch_tensors = batch_tensors.to(device)
            feats = model(batch_tensors)
            all_features.append(feats.cpu().numpy().astype(np.float32))
            all_ids.extend(batch_ids)

    features_arr = np.concatenate(all_features, axis=0)
    ids_arr = np.array(all_ids, dtype=object)
    labels_arr = np.array(manifest_labels, dtype=object)

    np.save(features_path, features_arr)
    np.save(ids_path, ids_arr)
    np.save(labels_path, labels_arr)

    print(f"Extraction complete! Saved features shape: {features_arr.shape} to {features_path}")
    return features_arr, ids_arr, labels_arr


def main() -> None:
    """CLI entry point for feature extraction."""
    parser = argparse.ArgumentParser(
        description="Extract DenseNet-121 features from manifest images"
    )
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
        help="Directory with preprocessed web images",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="../data/interim",
        help="Output directory for npy files",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for feature extraction",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of images (dev mode)",
    )
    args = parser.parse_args()

    manifest_file = Path(args.manifest).resolve()
    target_web_dir = Path(args.web_dir).resolve() if args.web_dir else None
    out_dir = Path(args.output_dir).resolve()

    extract_features(
        manifest_path=manifest_file,
        output_dir=out_dir,
        web_dir=target_web_dir,
        batch_size=args.batch_size,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
