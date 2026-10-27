"""Generate comprehensive evaluation report for the offline ML pipeline."""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

CLASSES = ["covid19", "pneumonia", "normal"]


def generate_ml_report(difficulty_df_path: Path, output_report_path: Path) -> None:
    """Compute performance metrics and write comprehensive report in Markdown."""
    df = pd.read_csv(difficulty_df_path)

    prob_cols = ["prob_covid19", "prob_pneumonia", "prob_normal"]
    pred_indices = np.argmax(df[prob_cols].values, axis=1)
    df["predicted_class"] = [CLASSES[idx] for idx in pred_indices]

    y_true = df["true_class"]
    y_pred = df["predicted_class"]

    accuracy = float((y_true == y_pred).mean())
    clf_rep = classification_report(y_true, y_pred, target_names=CLASSES, output_dict=True)
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)

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

## 4. Class by Data Source Breakdown

```
{class_source_tab}
```

---

## 5. Methodological Limitations and Ethical Disclosures

1. **Non-Clinical Educational Tool:** This model and difficulty scores are designed solely
   to structure adaptive practice questions for radiology residents. It is not approved
   or intended for clinical diagnosis, patient triaging, or real medical decision-making.
2. **Dataset-Shift and Shortcut Risk:**
   - COVID-19 cases were collected from multinational registries (Cohen and Figure1),
     whereas pneumonia and normal scans stem predominantly from pediatric radiographs (Kermany).
   - Although the pre-trained DenseNet-121 backbone was frozen to reduce dataset-specific
     over-fitting, differences in patient age and imaging equipment create potential domain shifts.
3. **Out-of-Fold Integrity:** Every single image was evaluated exclusively by a head
   trained on the remaining four folds, ensuring zero training data leakage in difficulty scores.
"""

    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"ML evaluation report successfully generated at {output_report_path}")


def main() -> None:
    """CLI entry point for report generation."""
    parser = argparse.ArgumentParser(description="Generate ML pipeline evaluation report")
    parser.add_argument("--difficulty-df", type=str, default="../data/interim/difficulty_df.csv")
    parser.add_argument("--output-report", type=str, default="../ml/reports/ml-report.md")
    args = parser.parse_args()

    generate_ml_report(
        difficulty_df_path=Path(args.difficulty_df).resolve(),
        output_report_path=Path(args.output_report).resolve(),
    )


if __name__ == "__main__":
    main()
