# Machine Learning Pipeline Evaluation Report

- **Model Backbone:** DenseNet-121 (Frozen ImageNet feature extractor, 1024-d)
- **Head:** Dense128 -> ReLU -> Dropout0.3 -> Dense64 -> ReLU -> Dropout0.3 -> Dense16 -> Softmax
- **Protocol:** Stratified 5-Fold Cross Validation (Out-of-Fold predictions)
- **Total Images:** 6004

---

## 1. Overall Performance

- **Out-of-Fold Accuracy:** **95.24%**
- **Macro Average F1-Score:** **0.9315**
- **Weighted Average F1-Score:** **0.9530**

### Per-Class Precision, Recall, and F1-Score

| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **COVID-19** | 0.8406 | 0.9831 | 0.9062 | 177 |
| **Pneumonia** | 0.8839 | 0.9621 | 0.9213 | 1582 |
| **Normal** | 0.9870 | 0.9475 | 0.9668 | 4245 |

---

## 2. Confusion Matrix (Out-of-Fold)

Rows = True Class, Columns = Predicted Class (`[covid19, pneumonia, normal]`):

```
                Predicted: covid19  pneumonia  normal
True: covid19              174             2       1
      pneumonia             24          4022     199
      normal                 9            51    1522
```

---

## 3. Difficulty and Bucket Distributions

Difficulty score formula: $d = 1 - P(y_{\text{true}} \mid x) \in [0, 1]$.
Buckets: Easy ($d < 0.34$), Medium ($0.34 \le d < 0.68$), Hard ($d \ge 0.68$).

### Sample Counts by Class and Difficulty Bucket

```
bucket      easy  hard  medium   All
true_class                          
covid19       59    59      59   177
normal       527   528     527  1582
pneumonia   1415  1415    1415  4245
All         2001  2002    2001  6004
```

### Difficulty Statistics per Class

```
            count      mean       std  min  median     max
true_class                                                
covid19       177  0.022830  0.127387  0.0  0.0000  0.9980
normal       1582  0.064452  0.165998  0.0  0.0089  0.9997
pneumonia    4245  0.067647  0.189585  0.0  0.0021  0.9998
```

---

## 4. Class by Data Source Breakdown

```
source      cohen  figure1  kermany   All
true_class                               
covid19       142       35        0   177
normal          0        0     1582  1582
pneumonia       0        0     4245  4245
All           142       35     5827  6004
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
