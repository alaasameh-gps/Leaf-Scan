# ملخص NLP (Natural Language Processing)

## 1. التعريف
NLP بيسمح للآلة تفهم وتتعامل مع اللغة البشرية.

## 2. نوع النظام
Retrieval-Based Grounded QA (مبني على مصادر موثقة) مش Generative عشوائي.

## 3. المصادر
- GBIF: بيانات نباتية علمية دقيقة
- Wikipedia: شرح الأمراض والأعراض

## 4. كيف بيشتغل
1. رفع صورة → تحديد class_id
2. جلب معلومات نباتية من GBIF
3. جلب معلومات المرض من Wikipedia بناءً على diseaseSearchTerm
4. عرض إجابة موثقة + مصادر
5. لو مفيش مصدر موثق → يظهر "غير متاح"

## 5. الملفات المرتبطة
gbif.ts, wikipedia.ts, botanical.ts, qa.ts + API routes + PlantChat.tsx

## 6. مبادئ النظام
- Grounded Answers (مبني على مصادر)
- No Fabrication (ما يخترعش)
- Retrieval-First
- Educational/Assistive فقط

## 7. الخلاصة
نظام QA مبني على استرجاع معلومات موثقة عشان يمنع Hallucination.
