# Manifest Generation Report

- **Total Scanned Images:** 6175
- **Valid Deduplicated Images:** 6004
- **Duplicates Dropped (by SHA-256):** 171
- **Corrupt / Unreadable Images Dropped:** 0

## Class x Source Distribution

```
source     cohen  figure1  kermany   All
label                                   
covid19      142       35        0   177
normal         0        0     1582  1582
pneumonia      0        0     4245  4245
All          142       35     5827  6004
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
