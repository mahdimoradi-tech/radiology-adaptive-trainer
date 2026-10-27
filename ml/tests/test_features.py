"""Unit tests for feature extraction."""

from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader

from extract_features import ChestXrayDataset, get_model_transform


def test_cxr_dataset(tmp_path: Path):
    """Test CXR dataset loading and transformation."""
    img_path = tmp_path / "img1.png"
    Image.new("RGB", (100, 100), color=(50, 100, 150)).save(img_path)

    dataset = ChestXrayDataset(
        image_ids=["sample_1"],
        paths=[str(img_path)],
        transform=get_model_transform(),
    )

    assert len(dataset) == 1
    img_id, tensor = dataset[0]
    assert img_id == "sample_1"
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32


def test_mock_feature_extraction(tmp_path: Path):
    """Test feature batching and numpy array assembly with a mock extractor."""
    img_paths = []
    ids = []
    for i in range(4):
        p = tmp_path / f"img_{i}.png"
        Image.new("RGB", (64, 64), color=(i * 40, i * 40, i * 40)).save(p)
        img_paths.append(str(p))
        ids.append(f"id_{i}")

    dataset = ChestXrayDataset(ids, img_paths, get_model_transform())
    loader = DataLoader(dataset, batch_size=2, shuffle=False)

    # Simple mock model simulating DenseNet-121 1024-d output
    mock_model = nn.Sequential(
        nn.AdaptiveAvgPool2d((1, 1)),
        nn.Flatten(),
        nn.Linear(3, 1024),
    )
    mock_model.eval()

    all_feats = []
    all_ids = []
    with torch.no_grad():
        for b_ids, b_tensors in loader:
            feats = mock_model(b_tensors)
            all_feats.append(feats.numpy())
            all_ids.extend(b_ids)

    feats_arr = np.concatenate(all_feats, axis=0)
    assert feats_arr.shape == (4, 1024)
    assert all_ids == ids
