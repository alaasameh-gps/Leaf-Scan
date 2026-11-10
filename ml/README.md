# Plant Leaf Disease Analysis (ML)

Transfer-learning classifier for the 39 leaf classes in the Mendeley dataset
*Data for Identification of Plant Leaf Diseases Using a 9-layer Deep Convolutional Neural Network*,
plus a FastAPI inference service the Next.js backend calls.

CPU-only friendly: everything here runs on the reference machine (Intel i7-6820HQ, no CUDA).

## Layout

```
ml/
  lib/               data loading, class parsing, in-memory zip reading
  scripts/           inspect_dataset, extract_dataset, make_splits, train, evaluate, baseline
  inference/         PlantDiseasePredictor (loads the checkpoint)
  service/           FastAPI app  (GET /health, GET /classes, POST /predict)
  artifacts/         generated reports, splits, metrics, confusion matrix  (gitignored)
  models/            trained checkpoints (*.pt)                            (gitignored)
  data/              extracted images                                      (gitignored)
  config.json        training hyper-parameters
  requirements.txt   python dependencies
```

> `ml/data/`, `ml/artifacts/`, `ml/models/` and `*.pt` are all gitignored.
> The dataset `.zip` in the repo root is also gitignored — never commit the dataset or weights.

## Setup (Windows PowerShell, from the project root)

```powershell
py -3.12 -m pip install -r ml/requirements.txt
```

The dataset zip must be present in the project root (its filename starts with
`Data for Identification of Plant Leaf Diseases`).

## Pipeline

```powershell
# 1. Inspect the archive (class counts, image sizes, duplicates) without extracting everything
py -3.12 ml/scripts/inspect_dataset.py

# 2. Extract a balanced subset (150 images per class = 5,850 images, ~90 MB)
py -3.12 ml/scripts/extract_dataset.py --per-class 150

# 3. Create train/val/test splits (seed 42)
py -3.12 ml/scripts/make_splits.py

# 4. Train MobileNetV3-Small
py -3.12 ml/scripts/train.py --epochs 6

# 5. Evaluate on the held-out test split
py -3.12 ml/scripts/evaluate.py --tag subset
```

`evaluate.py` writes `ml/artifacts/eval_metrics_<tag>.json` plus a confusion matrix
(`confusion_matrix_<tag>.png` / `.csv`).

## Run the inference service

```powershell
py -3.12 -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8000
```

The service binds to `127.0.0.1` only. If `PLANT_SERVICE_TOKEN` is set, send it as the
`X-Plant-Token` header. Endpoints:

- `GET  /health`   → model loaded, architecture, metrics, class count
- `GET  /classes`  → the 39 class ids
- `POST /predict`  → `{"image_base64": "...", "top_k": 3}`

Then start the app (`npm run dev` or `npm run build && npm run start`); the
`/api/plant/*` routes forward images to this service.

## Result metrics (honest, current state)

Trained on a **150-per-class subset** (5,850 images), 6 epochs on CPU:

| Split | Images | Accuracy | Macro F1 | Top-3 |
|-------|--------|----------|----------|-------|
| Val   | 858    | 0.9755   | 0.9754   | —     |
| Test  | 859    | 0.9814   | 0.9814   | 0.9988 |

**These are subset results and should not be presented as full-dataset metrics.**
The full archive holds 55,448 images; training on it was not run because the machine
does not have the free disk (and CPU time) available. Do not cite these numbers as
production/full-dataset accuracy.

To train on more data, raise `--per-class` in `extract_dataset.py` (or extract the full
`without_augmentation` zip) and re-run the pipeline. Expect much longer CPU training.

## Notes / limitations

- Only crop and condition are curated in `src/lib/plant/classes.ts`; pathogen, distribution
  and care facts are always retrieved live (GBIF / Wikipedia) and cited — never invented.
- Model outputs are statistical predictions over 39 categories, not diagnoses, and never
  drive pesticide or treatment recommendations.
