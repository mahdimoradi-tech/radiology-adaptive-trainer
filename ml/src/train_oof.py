"""Train 3-class classification head with Stratified 5-Fold out-of-fold predictions."""

import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import StratifiedKFold
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

CLASSES: List[str] = ["covid19", "pneumonia", "normal"]
CLASS_TO_IDX: Dict[str, int] = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS: Dict[int, str] = {i: c for i, c in enumerate(CLASSES)}
RANDOM_SEED: int = 42


def set_seed(seed: int = RANDOM_SEED) -> None:
    """Set random seed for reproducibility."""
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


class ClassificationHead(nn.Module):
    """DenseNet-121 classification head matching Kianmehr & Hashemzadeh (2025)."""

    def __init__(self, in_features: int = 1024, num_classes: int = 3, dropout_rate: float = 0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(64, 16),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(16, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def train_single_fold(
    x_train: torch.Tensor,
    y_train: torch.Tensor,
    x_val: torch.Tensor,
    y_val: torch.Tensor,
    max_epochs: int = 100,
    batch_size: int = 64,
    lr: float = 1e-3,
    patience: int = 8,
    lr_patience: int = 4,
    device: str = "cpu",
) -> nn.Module:
    """Train classification head on one fold with early stopping and LR scheduling."""
    model = ClassificationHead().to(device)

    # Compute balanced class weights for training set
    y_train_np = y_train.cpu().numpy()
    classes_present = np.unique(y_train_np)
    weights = compute_class_weight("balanced", classes=classes_present, y=y_train_np)
    weight_tensor = torch.zeros(len(CLASSES), dtype=torch.float32)
    for c, w in zip(classes_present, weights, strict=False):
        weight_tensor[c] = float(w)
    weight_tensor = weight_tensor.to(device)

    criterion = nn.CrossEntropyLoss(weight=weight_tensor)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=lr_patience
    )

    train_dataset = TensorDataset(x_train, y_train)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    best_loss = float("inf")
    patience_counter = 0
    best_state = None

    for _ in range(max_epochs):
        model.train()
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            out = model(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()

        # Validation
        model.eval()
        with torch.no_grad():
            vx, vy = x_val.to(device), y_val.to(device)
            val_out = model(vx)
            val_loss = criterion(val_out, vy).item()

        scheduler.step(val_loss)

        if val_loss < best_loss - 1e-4:
            best_loss = val_loss
            patience_counter = 0
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    return model


def predict_probabilities(
    model: nn.Module, x_test: torch.Tensor, device: str = "cpu"
) -> np.ndarray:
    """Predict class probabilities using softmax."""
    model.eval()
    with torch.no_grad():
        x_test = x_test.to(device)
        logits = model(x_test)
        probs = torch.softmax(logits, dim=-1)
        return probs.cpu().numpy()


def run_oof_training(
    features: np.ndarray,
    labels: np.ndarray,
    ids: np.ndarray,
    n_splits: int = 5,
    seed: int = RANDOM_SEED,
    device: str = "cpu",
) -> Tuple[np.ndarray, np.ndarray]:
    """Execute stratified 5-fold cross validation and return out-of-fold probability matrix."""
    set_seed(seed)
    n_samples = len(features)
    y_indices = np.array([CLASS_TO_IDX[label] for label in labels], dtype=np.int64)

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    oof_probs = np.zeros((n_samples, len(CLASSES)), dtype=np.float32)
    assigned_folds = np.zeros(n_samples, dtype=np.int32)

    features_tensor = torch.tensor(features, dtype=torch.float32)
    labels_tensor = torch.tensor(y_indices, dtype=torch.int64)

    print(f"Starting {n_splits}-fold Out-of-Fold training on {device.upper()}...")
    for fold, (train_idx, test_idx) in enumerate(
        tqdm(skf.split(features, y_indices), total=n_splits, desc="OOF Folds")
    ):
        assigned_folds[test_idx] = fold

        # Reserve 10% of train_idx for validation / early stopping
        np.random.seed(seed + fold)
        shuffled_train = np.random.permutation(train_idx)
        val_size = max(1, int(len(train_idx) * 0.10))
        val_idx = shuffled_train[:val_size]
        actual_train_idx = shuffled_train[val_size:]

        x_tr = features_tensor[actual_train_idx]
        y_tr = labels_tensor[actual_train_idx]
        x_val = features_tensor[val_idx]
        y_val = labels_tensor[val_idx]
        x_te = features_tensor[test_idx]

        model = train_single_fold(x_tr, y_tr, x_val, y_val, device=device)
        test_probs = predict_probabilities(model, x_te, device=device)
        oof_probs[test_idx] = test_probs

    return oof_probs, assigned_folds


def main() -> None:
    """CLI entry point for OOF training."""
    parser = argparse.ArgumentParser(
        description="Train 3-class classifier with 5-fold OOF predictions"
    )
    parser.add_argument(
        "--features", type=str, default="../data/interim/features.npy", help="Path to features.npy"
    )
    parser.add_argument(
        "--labels", type=str, default="../data/interim/labels.npy", help="Path to labels.npy"
    )
    parser.add_argument(
        "--ids", type=str, default="../data/interim/ids.npy", help="Path to ids.npy"
    )
    parser.add_argument(
        "--output-dir", type=str, default="../data/interim", help="Output directory"
    )
    parser.add_argument("--n-splits", type=int, default=5, help="Number of folds (default: 5)")
    args = parser.parse_args()

    feats = np.load(args.features)
    labels = np.load(args.labels, allow_pickle=True)
    ids = np.load(args.ids, allow_pickle=True)

    oof_probs, assigned_folds = run_oof_training(feats, labels, ids, n_splits=args.n_splits)

    out_dir = Path(args.output_dir).resolve()
    np.save(out_dir / "oof_probs.npy", oof_probs)
    np.save(out_dir / "assigned_folds.npy", assigned_folds)
    print(f"OOF training complete. Saved oof_probs shape: {oof_probs.shape} to {out_dir}")


if __name__ == "__main__":
    main()
