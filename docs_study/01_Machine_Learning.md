# ملخص Machine Learning (التعلم الآلي)

## 1. الهدف العام
بنستخدم الـ Machine Learning عشان نبني نموذج يقدر يتنبأ بمرض النبات من صورة الورقة، بناءً على بيانات مُصنفة (Supervised Learning).

## 2. نوع المشكلة
- Multi-class Image Classification (تصنيف متعدد الفئات)
- كل صورة ليها Label واحد (اسم المرض أو healthy أو Background_without_leaves)
- العدد الكلي للفئات: 98 صنف (39 من PlantVillage + 59 من الداتا الجديدة)

## 3. خطوات الـ ML اللي اتعملت

### أ. جمع وتجميع البيانات
- دمجنا داتا قديمة: PlantVillage_full (55,448 صورة – 39 صنف)
- دمجنا داتا جديدة من Project-AgML
- الداتا المجمعة: D:/leafscan_dataset/ بـ 85,875 صورة، 98 صنف
- توحيد أسماء الفئات بالشكل Plant___Disease

### ب. تقسيم البيانات
- Train: 60,101 (70%)
- Validation: 12,891 (15%)
- Test: 12,883 (15%)
- Stratified حسب توزيع الفئات

### ج. التعامل مع عدم توازن الفئات
- WeightedRandomSampler أثناء التدريب عشان نوازن بين الفئات

### د. مقاييس التقييم
- Accuracy, Precision (Macro), Recall (Macro), F1-Macro, F1-Weighted, Top-3 Accuracy

### هـ. نتائج التقييم على Test Set
| المقياس | القيمة |
|---|---|
| Accuracy | 0.9788 |
| F1-Macro | 0.9549 |
| Precision-Macro | 0.9558 |
| Recall-Macro | 0.9563 |
| F1-Weighted | 0.9791 |
| Top-3 Accuracy | 0.9991 |

## 4. الخلاصة
Supervised Learning + Transfer Learning لحل تصنيف صور متعدد الفئات.
