# DATA SOURCES

Registry of public chest X-ray datasets used for difficulty modeling, out-of-fold probability estimation, and question generation.
Raw images and labels are stored locally outside Git in `data/raw/` and documented here.

| Dataset Name | Source / URL | License | Total Images | Classes Covered | Local Path | Verified By |
|---|---|---|---|---|---|---|
| **Kermany Chest X-Ray** | [Mendeley Data](https://data.mendeley.com/datasets/rscbjbr9sj/3) (DOI: 10.17632/rscbjbr9sj.3) / [Kaggle](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) | CC BY 4.0 | 5,856 (1,583 normal, 4,273 pneumonia) | `normal`, `pneumonia` | `data/raw/kermany/chest_xray/` | Operator A (Mahdi Moradi) |
| **Cohen COVID-19** | [GitHub ieee8023](https://github.com/ieee8023/covid-chestxray-dataset) / [Figshare](https://figshare.com/articles/dataset/Cohen_J_P_Dataset_COVID-19_Images/27941796) | CC BY-NC-SA 4.0 / Open Academic | 426 (284 Covid, 142 Normal) | `covid19`, `normal` | `data/raw/cohen/CovidDataset/` | Operator A (Mahdi Moradi) |
| **Figure 1 COVID-19** | [GitHub agchung](https://github.com/agchung/Figure1-COVID-chestxray-dataset) | MIT License | 55 (35 confirmed COVID-19) | `covid19` | `data/raw/Figure1/Figure1-COVID-chestxray-dataset-master/` | Operator A (Mahdi Moradi) |

*Note: Raw medical images must never be committed to Git. Catalog archives are shared out-of-band between operators. The `actualmed` dataset archive (`data/actualmed.zip`) is retained locally as an optional supplementary source; the active baseline pipeline operates on Kermany + Cohen + Figure1, providing 6,337 raw candidate images across all three target classes.*

## Citations

1. **Kermany et al. (2018)**: Kermany, D. S., Goldbaum, M., Cai, W., et al. "Identifying Medical Diagnoses and Treatable Diseases by Image-Based Deep Learning", *Cell*, 172(5), 1122-1131.
2. **Cohen et al. (2020)**: Cohen, J. P., Morrison, P., Dao, L., Roth, K., Duong, T. Q., Ghassemi, M. "COVID-19 Image Data Collection: Prospective Predictions Are the Hardest", *arXiv:2003.11597*.
3. **Chung et al. / COVID-Net (2020)**: Chung, A., Wang, L. "Figure 1 COVID-19 Chest X-ray Dataset Initiative", COVID-Net open initiative.
4. **Reference Paper**: Kianmehr, E., Hashemzadeh, M. "Personalization of the Radiology Residency Training Process Using Deep Learning and Interactive Extraction of Diagnostic Error Patterns", *Journal of ICT (Iran)*, 17(66-67), 102-127, 2025.
