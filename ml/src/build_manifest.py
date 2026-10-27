"""Build manifest from raw dataset directories with deduplication and validation."""

import argparse
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from PIL import Image

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def compute_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def is_valid_image(filepath: Path) -> bool:
    """Check if file can be opened as a valid image."""
    try:
        with Image.open(filepath) as img:
            img.verify()
        return True
    except Exception:
        return False


def scan_kermany(kermany_root: Path) -> List[Dict[str, str]]:
    """Scan Kermany dataset (chest_xray/train, test)."""
    records = []
    if not kermany_root.exists():
        return records

    for path in kermany_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS:
            parts = [p.upper() for p in path.parts]
            label = None
            if "NORMAL" in parts:
                label = "normal"
            elif "PNEUMONIA" in parts:
                label = "pneumonia"

            if label:
                records.append(
                    {
                        "path": str(path.resolve()),
                        "source": "kermany",
                        "label": label,
                    }
                )
    return records


def scan_cohen(cohen_root: Path) -> List[Dict[str, str]]:
    """Scan Cohen dataset (CovidDataset/Train, Val)."""
    records = []
    if not cohen_root.exists():
        return records

    for path in cohen_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS:
            parts = [p.lower() for p in path.parts]
            label = None
            if "covid" in parts:
                label = "covid19"
            elif "normal" in parts:
                label = "normal"

            if label:
                records.append(
                    {
                        "path": str(path.resolve()),
                        "source": "cohen",
                        "label": label,
                    }
                )
    return records


def scan_figure1(figure1_root: Path) -> List[Dict[str, str]]:
    """Scan Figure1 dataset with metadata.csv filtering."""
    records = []
    if not figure1_root.exists():
        return records

    meta_file = next(figure1_root.rglob("metadata.csv"), None)
    images_dir = next((d for d in figure1_root.rglob("images") if d.is_dir()), None)

    if meta_file and meta_file.is_file() and images_dir:
        try:
            df = pd.read_csv(meta_file, encoding="latin1")
            for _, row in df.iterrows():
                finding = str(row.get("finding", "")).strip()
                if "COVID-19" in finding:
                    patient_id = str(row.get("patientid", "")).strip()
                    for ext in [".jpg", ".jpeg", ".png"]:
                        img_path = images_dir / f"{patient_id}{ext}"
                        if img_path.is_file():
                            records.append(
                                {
                                    "path": str(img_path.resolve()),
                                    "source": "figure1",
                                    "label": "covid19",
                                }
                            )
                            break
        except Exception as e:
            print(f"Warning parsing Figure1 metadata: {e}")
    else:
        for path in figure1_root.rglob("*"):
            if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS:
                records.append(
                    {
                        "path": str(path.resolve()),
                        "source": "figure1",
                        "label": "covid19",
                    }
                )

    return records


def scan_actualmed(actualmed_root: Path) -> List[Dict[str, str]]:
    """Scan Actualmed dataset with metadata.csv filtering."""
    records = []
    if not actualmed_root.exists():
        return records

    meta_file = next(actualmed_root.rglob("metadata.csv"), None)
    images_dir = next((d for d in actualmed_root.rglob("images") if d.is_dir()), None)

    if meta_file and meta_file.is_file() and images_dir:
        try:
            df = pd.read_csv(meta_file, encoding="latin1")
            for _, row in df.iterrows():
                finding = str(row.get("finding", "")).strip()
                if "COVID-19" in finding:
                    patient_id = str(row.get("patientid", "")).strip()
                    for ext in [".jpg", ".jpeg", ".png"]:
                        img_path = images_dir / f"{patient_id}{ext}"
                        if img_path.is_file():
                            records.append(
                                {
                                    "path": str(img_path.resolve()),
                                    "source": "actualmed",
                                    "label": "covid19",
                                }
                            )
                            break
        except Exception as e:
            print(f"Warning parsing Actualmed metadata: {e}")
    else:
        for path in actualmed_root.rglob("*"):
            if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS:
                records.append(
                    {
                        "path": str(path.resolve()),
                        "source": "actualmed",
                        "label": "covid19",
                    }
                )

    return records


def build_manifest(
    raw_dir: Path,
    output_path: Path,
    report_path: Optional[Path] = None,
    limit: Optional[int] = None,
) -> Tuple[pd.DataFrame, Dict]:
    """Scan all raw datasets, deduplicate by SHA-256, and save manifest."""
    raw_records: List[Dict[str, str]] = []

    kermany_dirs = [d for d in raw_dir.glob("*") if "kermany" in d.name.lower()]
    cohen_dirs = [d for d in raw_dir.glob("*") if "cohen" in d.name.lower()]
    figure1_dirs = [d for d in raw_dir.glob("*") if "figure1" in d.name.lower()]
    actualmed_dirs = [d for d in raw_dir.glob("*") if "actualmed" in d.name.lower()]

    for d in kermany_dirs:
        raw_records.extend(scan_kermany(d))
    for d in cohen_dirs:
        raw_records.extend(scan_cohen(d))
    for d in figure1_dirs:
        raw_records.extend(scan_figure1(d))
    for d in actualmed_dirs:
        raw_records.extend(scan_actualmed(d))

    total_scanned = len(raw_records)

    clean_records = []
    seen_hashes: Set[str] = set()
    duplicate_count = 0
    unreadable_count = 0

    for item in raw_records:
        path = Path(item["path"])
        if not is_valid_image(path):
            unreadable_count += 1
            continue

        sha256 = compute_sha256(path)
        if sha256 in seen_hashes:
            duplicate_count += 1
            continue

        seen_hashes.add(sha256)
        image_id = f"{item['source']}_{sha256[:12]}"
        clean_records.append(
            {
                "image_id": image_id,
                "path": item["path"],
                "source": item["source"],
                "label": item["label"],
                "sha256": sha256,
            }
        )

    df = pd.DataFrame(clean_records)
    if limit is not None and limit > 0 and len(df) > limit:
        df = df.iloc[:limit].copy()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    stats = {
        "total_scanned": total_scanned,
        "clean_count": len(df),
        "duplicate_count": duplicate_count,
        "unreadable_count": unreadable_count,
    }

    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        cross_tab = pd.crosstab(df["label"], df["source"], margins=True) if not df.empty else ""
        report_content = f"""# Manifest Generation Report

- **Total Scanned Images:** {total_scanned}
- **Valid Deduplicated Images:** {len(df)}
- **Duplicates Dropped (by SHA-256):** {duplicate_count}
- **Corrupt / Unreadable Images Dropped:** {unreadable_count}

## Class x Source Distribution

```
{cross_tab}
```

## Methodology & Risk Disclosure

1. **Deduplication:** Computed SHA-256 hashes across all image files. Identical scans
   appearing in multiple splits or datasets are strictly dropped to prevent data leakage.
2. **Source-Shortcut Risk:** COVID-19 cases originate from Cohen and Figure1 initiatives,
   whereas Pneumonia scans originate from the Kermany pediatric cohort. In deep learning models,
   there is an inherent risk of learning dataset-specific acquisition artifacts (e.g. patient age,
   border markers, scanner calibration) rather than true pathology.
3. **Mitigation Strategy:**
   - Pre-trained DenseNet-121 backbone weights are strictly frozen to use generic representations.
   - Out-of-Fold (OOF) 5-fold cross validation guarantees that every image is scored by a head
     that never trained on it.
"""
        with open(report_path, "w", encoding="utf-8") as rf:
            rf.write(report_content)

    return df, stats


def main() -> None:
    """CLI entry point for manifest generation."""
    parser = argparse.ArgumentParser(
        description="Build dataset manifest with SHA-256 deduplication"
    )
    parser.add_argument(
        "--raw-dir", type=str, default="../data/raw", help="Path to raw datasets directory"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../data/interim/manifest.csv",
        help="Path to output manifest CSV",
    )
    parser.add_argument(
        "--report",
        type=str,
        default="../ml/reports/manifest-report.md",
        help="Path to report markdown file",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Limit number of images for dev mode"
    )
    args = parser.parse_args()

    raw_path = Path(args.raw_dir).resolve()
    out_path = Path(args.output).resolve()
    rep_path = Path(args.report).resolve() if args.report else None

    print(f"Scanning datasets from: {raw_path}")
    df, stats = build_manifest(raw_path, out_path, rep_path, limit=args.limit)
    print("Manifest generation complete!")
    print(f"Total scanned: {stats['total_scanned']}")
    print(f"Clean saved: {stats['clean_count']}")
    print(f"Duplicates: {stats['duplicate_count']}")
    print(f"Unreadable: {stats['unreadable_count']}")
    print(f"Output saved to: {out_path}")
    if rep_path:
        print(f"Report saved to: {rep_path}")


if __name__ == "__main__":
    main()
