# ملخص Deep Learning (التعلم العميق)

## 1. التعريف
Deep Learning جزء من ML بيستخدم Neural Networks عشان يتعلم الميزات من الصور مباشرة.

## 2. النموذج المستخدم
- MobileNetV3-Small (Transfer Learning)
- خفيف وسريع ومناسب للـ CPU
- Pretrained على ImageNet
- عدد الفئات: 98

## 3. خطوات التدريب

### أ. Transfer Learning
نعدل الطبقة الأخيرة classifier عشان تناسب 98 صنف بدل 1000.

### ب. Two-Phase Fine-Tuning
1. Epoch 1: نجمد Backbone ونتمرن على Head فقط
2. Epoch 2+: نفك تجميد Backbone ب Learning Rate أقل

### ج. إعدادات التدريب
- Loss: CrossEntropyLoss + Label Smoothing (0.1)
- Optimizer: AdamW + Weight Decay
- Scheduler: Cosine Annealing
- Early Stopping (Patience=3)
- WeightedRandomSampler لمعالجة عدم التوازن

## 4. نتائج التدريب
أعلي Validation F1-Macro: 0.9553 عند Epoch 9

## 5. الخلاصة
Transfer Learning + Fine-Tuning على MobileNetV3-Small يعطي دقة عالية ويشتغل كويس على CPU.
