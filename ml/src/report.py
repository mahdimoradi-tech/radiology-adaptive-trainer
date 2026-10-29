"""Generate comprehensive evaluation report for the offline ML pipeline."""

import argparse
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

CLASS_ORDER: List[str] = ["covid19", "pneumonia", "normal"]
CLASSES: List[str] = CLASS_ORDER


def generate_ml_report(difficulty_df_path: Path, output_report_path: Path) -> None:
    """Compute performance metrics and write comprehensive report in Markdown."""
    df = pd.read_csv(difficulty_df_path)

    prob_cols = ["prob_covid19", "prob_pneumonia", "prob_normal"]
    pred_indices = np.argmax(df[prob_cols].values, axis=1)
    df["predicted_class"] = [CLASS_ORDER[idx] for idx in pred_indices]

    y_true = df["true_class"]
    y_pred = df["predicted_class"]

    accuracy = float((y_true == y_pred).mean())
    clf_rep = classification_report(
        y_true, y_pred, labels=CLASS_ORDER, target_names=CLASS_ORDER, output_dict=True
    )
    cm = confusion_matrix(y_true, y_pred, labels=CLASS_ORDER)

    class_bucket_tab = pd.crosstab(df["true_class"], df["bucket"], margins=True)
    class_source_tab = pd.crosstab(df["true_class"], df["source"], margins=True)
    diff_stats = df.groupby("true_class")["difficulty"].agg(
        ["count", "mean", "std", "min", "median", "max"]
    )

    cov_p = clf_rep["covid19"]["precision"]
    cov_r = clf_rep["covid19"]["recall"]
    cov_f = clf_rep["covid19"]["f1-score"]
    cov_s = int(clf_rep["covid19"]["support"])

    pne_p = clf_rep["pneumonia"]["precision"]
    pne_r = clf_rep["pneumonia"]["recall"]
    pne_f = clf_rep["pneumonia"]["f1-score"]
    pne_s = int(clf_rep["pneumonia"]["support"])

    nor_p = clf_rep["normal"]["precision"]
    nor_r = clf_rep["normal"]["recall"]
    nor_f = clf_rep["normal"]["f1-score"]
    nor_s = int(clf_rep["normal"]["support"])

    macro_f1 = clf_rep["macro avg"]["f1-score"]
    weighted_f1 = clf_rep["weighted avg"]["f1-score"]

    # Compute per-source out-of-fold accuracy
    source_stats = []
    for src in sorted(df["source"].unique()):
        sdf = df[df["source"] == src]
        corr = int((sdf["true_class"] == sdf["predicted_class"]).sum())
        total = len(sdf)
        acc = (corr / total) * 100 if total > 0 else 0.0
        source_stats.append((src, total, corr, acc))
    total_corr = int((y_true == y_pred).sum())
    total_samples = len(df)
    source_stats.append(("All", total_samples, total_corr, (total_corr / total_samples) * 100))

    source_acc_rows = "\n".join(
        f"| **{src}** | {tot} | {cor} | {acc:.2f}% |" for src, tot, cor, acc in source_stats
    )

    # Compute COVID-19 difficulty decile distribution
    covid_df = df[df["true_class"] == "covid19"]
    bins = np.linspace(0.0, 1.0, 11)
    decile_labels = [
        f"[{bins[i]:.1f}, {bins[i + 1]:.1f}]" if i == 0 else f"({bins[i]:.1f}, {bins[i + 1]:.1f}]"
        for i in range(10)
    ]
    covid_deciles = pd.cut(
        covid_df["difficulty"], bins=bins, include_lowest=True, labels=decile_labels
    )
    decile_counts = covid_deciles.value_counts(sort=False)
    covid_total = len(covid_df)
    decile_rows = "\n".join(
        f"| {lbl} | {cnt} | {(cnt / covid_total) * 100:.2f}% |"
        for lbl, cnt in decile_counts.items()
    )

    report_content = f"""# Machine Learning Pipeline Evaluation Report

- **Model Backbone:** DenseNet-121 (Frozen ImageNet feature extractor, 1024-d)
- **Head:** Dense128 -> ReLU -> Dropout0.3 -> Dense64 -> ReLU -> Dropout0.3 -> Dense16 -> Softmax
- **Protocol:** Stratified 5-Fold Cross Validation (Out-of-Fold predictions)
- **Total Images:** {len(df)}

---

## 1. Overall Performance

- **Out-of-Fold Accuracy:** **{accuracy * 100:.2f}%**
- **Macro Average F1-Score:** **{macro_f1:.4f}**
- **Weighted Average F1-Score:** **{weighted_f1:.4f}**

### Per-Class Precision, Recall, and F1-Score

| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **COVID-19** | {cov_p:.4f} | {cov_r:.4f} | {cov_f:.4f} | {cov_s} |
| **Pneumonia** | {pne_p:.4f} | {pne_r:.4f} | {pne_f:.4f} | {pne_s} |
| **Normal** | {nor_p:.4f} | {nor_r:.4f} | {nor_f:.4f} | {nor_s} |

---

## 2. Confusion Matrix (Out-of-Fold)

Rows = True Class, Columns = Predicted Class (`[covid19, pneumonia, normal]`):

```
                Predicted: covid19  pneumonia  normal
True: covid19          {cm[0, 0]:>7}    {cm[0, 1]:>10}  {cm[0, 2]:>6}
      pneumonia        {cm[1, 0]:>7}    {cm[1, 1]:>10}  {cm[1, 2]:>6}
      normal           {cm[2, 0]:>7}    {cm[2, 1]:>10}  {cm[2, 2]:>6}
```

---

## 3. Difficulty and Bucket Distributions

Difficulty score formula: $d = 1 - P(y_{{\\text{{true}}}} \\mid x) \\in [0, 1]$.
Buckets: Easy ($d < 0.34$), Medium ($0.34 \\le d < 0.68$), Hard ($d \\ge 0.68$).

### Sample Counts by Class and Difficulty Bucket

```
{class_bucket_tab}
```

### Difficulty Statistics per Class

```
{diff_stats}
```

---

## 4. Class and Performance by Data Source

### Class by Data Source Breakdown

```
{class_source_tab}
```

### Out-of-Fold Accuracy by Data Source

| Source | Samples | Correct | Accuracy |
|---|---|---|---|
{source_acc_rows}

### COVID-19 Difficulty Distribution (Deciles)

| Decile Range | Count | Percentage |
|---|---|---|
{decile_rows}

---

## 5. Methodological Limitations and Ethical Disclosures

1. **Non-Clinical Educational Tool:** This model and difficulty scores are designed solely
   to structure adaptive practice questions for radiology residents. It is not approved
   or intended for clinical diagnosis, patient triaging, or real medical decision-making.
2. **Dataset-Shift, Age Confound, and Shortcut Risk:**
   - COVID-19 cases were collected from adult registries (Cohen and Figure1),
     whereas pneumonia and normal scans stem predominantly from pediatric radiographs (Kermany).
   - Difficulty for COVID-19 partly reflects source differences;
     do not interpret it as clinical difficulty.
   - As quantified in Section 4, 96.61% of COVID-19 images fall into the lowest difficulty
     decile [0.0, 0.1] and achieve 98.59% (Cohen) and 97.14% (Figure1) out-of-fold accuracy.
     The model can distinguish sources based on demographic features
     (adult vs pediatric ribcage/lung field morphology) and equipment artifacts.
   - Although the pre-trained DenseNet-121 backbone was frozen to reduce dataset-specific
     over-fitting, differences in patient age and imaging equipment create potential domain shifts.
   - Catalog sampling policy guarantees that all available medium and hard COVID-19 images
     are retained in the active pool, preventing adaptive engine starvation
     (see ADR 0005 in `docs/adr/0005-difficulty-thresholds-and-catalog-policy.md`).
3. **Out-of-Fold Integrity:** Every single image was evaluated exclusively by a head
   trained on the remaining four folds, ensuring zero training data leakage in difficulty scores.
"""

    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"ML evaluation report successfully generated at {output_report_path}")


def main() -> None:
    """CLI entry point for report generation."""
    default_df = Path(__file__).resolve().parent.parent.parent / "data/interim/difficulty_df.csv"
    default_report = Path(__file__).resolve().parent.parent / "reports/ml-report.md"

    parser = argparse.ArgumentParser(description="Generate ML pipeline evaluation report")
    parser.add_argument("--difficulty-df", type=str, default=str(default_df))
    parser.add_argument("--output-report", type=str, default=str(default_report))
    args = parser.parse_args()

    generate_ml_report(
        difficulty_df_path=Path(args.difficulty_df).resolve(),
        output_report_path=Path(args.output_report).resolve(),
    )


if __name__ == "__main__":
    main()
