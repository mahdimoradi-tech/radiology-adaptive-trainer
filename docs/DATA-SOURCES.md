# DATA SOURCES

Registry of public chest X-ray datasets used for difficulty modeling, out-of-fold probability estimation, multimodal analysis, and question generation.
Raw images and labels are stored locally outside Git in `data/raw/` and documented here.

| Dataset Name | Source / URL | License | Total Images | Classes Covered | Local Path | Verified By |
|---|---|---|---|---|---|---|
| **Kermany Chest X-Ray** | [Mendeley Data](https://data.mendeley.com/datasets/rscbjbr9sj/3) (DOI: 10.17632/rscbjbr9sj.3) / [Kaggle](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) | to be verified by the developer | 5,856 (1,583 normal, 4,273 pneumonia) | `normal`, `pneumonia` | `data/raw/kermany/chest_xray/` | Mahdi Moradi |
| **Cohen COVID-19** | [GitHub ieee8023](https://github.com/ieee8023/covid-chestxray-dataset) / [Figshare](https://figshare.com/articles/dataset/Cohen_J_P_Dataset_COVID-19_Images/27941796) | to be verified by the developer | 426 (284 Covid, 142 Normal) | `covid19`, `normal` | `data/raw/cohen/CovidDataset/` | Mahdi Moradi |
| **Figure 1 COVID-19** | [GitHub agchung](https://github.com/agchung/Figure1-COVID-chestxray-dataset) | to be verified by the developer | 55 (35 confirmed COVID-19) | `covid19` | `data/raw/Figure1/Figure1-COVID-chestxray-dataset-master/` | Mahdi Moradi |

*Note: Raw medical images must never be committed to Git. Catalog archives are stored locally outside git. The `actualmed` dataset archive (`data/actualmed.zip`) is retained locally as an optional supplementary source; the active baseline pipeline operates on Kermany + Cohen + Figure1, providing 6,337 raw candidate images across all three target classes.*

## API and Cloud Service Terms Notice

- **Google Gemini Free-Tier:** In the multimodal image analysis pipeline (`T08a`), catalog images are transmitted to Google's Gemini API (`gemini-3.8-flash`). Note that Google AI Studio free-tier terms of service may allow Google to review and use submitted content for model improvement and product maintenance (the developer must verify current terms and compliance before uploading proprietary or non-public clinical data). No resident personal data or patient identifiable information is ever transmitted.

## Citations

1. **Kermany et al. (2018)**: Kermany, D. S., Goldbaum, M., Cai, W., et al. "Identifying Medical Diagnoses and Treatable Diseases by Image-Based Deep Learning", *Cell*, 172(5), 1122-1131.
2. **Cohen et al. (2020)**: Cohen, J. P., Morrison, P., Dao, L., Roth, K., Duong, T. Q., Ghassemi, M. "COVID-19 Image Data Collection: Prospective Predictions Are the Hardest", *arXiv:2003.11597*.
3. **Chung et al. / COVID-Net (2020)**: Chung, A., Wang, L. "Figure 1 COVID-19 Chest X-ray Dataset Initiative", COVID-Net open initiative.
4. **Reference Paper**: Kianmehr, E., Hashemzadeh, M. "Personalization of the Radiology Residency Training Process Using Deep Learning and Interactive Extraction of Diagnostic Error Patterns", *Journal of ICT (Iran)*, 17(66-67), 102-127, 2025.
