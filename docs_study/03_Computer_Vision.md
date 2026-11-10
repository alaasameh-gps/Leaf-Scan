# ملخص Computer Vision (رؤية الحاسوب)

## 1. التعريف
Computer Vision بيسمح للآلة تحلل الصور وتصنفها.

## 2. معالجة الصور

### أ. Data Augmentation (Training)
- RandomResizedCrop(224)
- RandomHorizontalFlip, RandomVerticalFlip(0.15)
- RandomRotation(20°)
- ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02)
- ToTensor + Normalize(ImageNet)

### ب. Preprocessing (Validation/Test/Inference)
- Resize(224*1.14) + CenterCrop(224)
- ToTensor + Normalize
هدفه يضمن التناسق بين التدريب والاستنتاج

### ج. Normalization
mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]

## 3. Inference Pipeline
1. استقبال صورة base64
2. تحويل لـ PIL Image (RGB)
3. Preprocessing مطابق للتقييم
4. التنبؤ Top-K مع Confidence
5. الرد JSON

## 4. الخلاصة
معالجة الصور بشكل منسق بين التدريب والاستنتاج يضمن دقة التوقعات.
