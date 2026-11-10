# عين النبات | LeafScan

منصة عربية (RTL) لتحليل أمراض أوراق النبات بالذكاء الاصطناعي. ارفع صورة ورقة أو التقطها بالكاميرا، فيتنبأ نموذج تعلّم عميق بالفئة المتوقعة من **39 فئة**، ثم تعرض معلومات نباتية موثّقة من **GBIF** و**ويكيبيديا** مع روابط المصادر.

> هذا الموقع تحوّل كاملًا من منصة كورسات سابقة إلى تحليل نباتات. ميزات الكورسات والسلة والدفع ولوحة التحكم أُزيلت بالكامل.

## المميزات

- تحليل صورة ورقة (رفع ملف أو التقاط بالكاميرا) والتنبؤ بواحد من 39 فئة مرضية
- درجة الثقة + التوقعات البديلة + تنبيهات عند انخفاض الثقة
- معلومات نباتية موثّقة: التصنيف العلمي من GBIF، ونصوص من ويكيبيديا، مع رابط لكل مصدر
- مساعد أسئلة يجيب من النصوص المسترجعة فقط (لا يُلفّق حقائق)
- سجل التحليلات محفوظ لكل مستخدم (بعد تسجيل الدخول)

## التقنيات

| الطبقة | التقنية |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS, RTL/Arabic |
| Backend | Next.js API routes, MongoDB (Mongoose), JWT + bcrypt |
| ML / Inference | PyTorch (MobileNetV3-Small), FastAPI, CPU-friendly |
| Data sources | GBIF API, Wikipedia API |

## هيكلة المشروع

```
src/
├── app/
│   ├── plant/              # صفحة تحليل النبات (واجهة المستخدم)
│   ├── login/ register/    # تسجيل الدخول وإنشاء حساب
│   └── api/
│       ├── plant/          # analyze, classes, botanical, ask, history, health
│       ├── auth/           # login, register, me, logout
│       └── health/         # فحص صحة التطبيق والخدمات
├── components/plant/       # PlantAnalyzer, PlantResults, PlantChat, CameraCapture
├── lib/plant/              # inference client, GBIF/Wikipedia, botanical, qa, validation
├── models/                 # PlantAnalysis, User
ml/                         # خط تدريب البيانات + خدمة استدلال FastAPI (شوف ml/README.md)
```

## التشغيل

### 1) المتطلبات
- Node.js 18+ و MongoDB
- Python 3.12 (لخدمة الاستدلال)

### 2) الإعداد

```bash
npm install
cp .env.example .env      # ثم عبّئ MONGODB_URI و AUTH_SECRET
py -3.12 -m pip install -r ml/requirements.txt
```

### 3) بناء النموذج (مرة واحدة) — التفاصيل في [ml/README.md](ml/README.md)

```powershell
py -3.12 ml/scripts/inspect_dataset.py
py -3.12 ml/scripts/extract_dataset.py --per-class 150
py -3.12 ml/scripts/make_splits.py
py -3.12 ml/scripts/train.py --epochs 6
py -3.12 ml/scripts/evaluate.py --tag subset
```

### 4) التشغيل (نافذتين/طاقمين)

```powershell
# نافذة 1: خدمة الاستدلال (ضرورية، بدونها تفشل صور التحليل)
py -3.12 -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8000

# نافذة 2: التطبيق
npm run dev
# أو للإنتاج
npm run build ; npm run start
```

افتح [http://localhost:3000/plant](http://localhost:3000/plant).

## نتائج التدريب الحالية (صادقة)

دُرِّب النموذج على **عينة متوازنة من 150 صورة لكل فئة** (5,850 صورة)، 6 عصور على CPU:

| Split | صور | Accuracy | Macro F1 | Top-3 |
|-------|-----|----------|----------|-------|
| Val   | 858 | 0.9755   | 0.9754   | —     |
| Test  | 859 | 0.9814   | 0.9814   | 0.9988 |

> **تنبيه:** هذه نتائج على العينة المذكورة، وليست على قاعدة البيانات الكاملة (55,448 صورة). التدريب الكامل لم يُنفَّذ لضيق مساحة القرص/CPU على الجهاز المرجعي. لا تُعرض هذه الأرقام كأداء إنتاج كامل.

## نطاق الدعم وحدود الاستخدام

- النموذج مدرَّب على 39 فئة محددة (14 محصولًا + أمراضها + فئة "بدون أوراق")، وليس قاعدة معرفة لكل النباتات.
- التنبؤات احتمالية وليست تشخيصًا نهائيًا، وقد تخطئ مع الصور غير الواضحة أو الفئات غير المدعومة.
- المعلومات تُجلب حيًّا من GBIF وويكيبيديا مع ذكر المصادر؛ الموقع لا يؤلف أسماء علمية ولا يقدّم توصيات مبيدات أو علاج. راجع جهة إرشاد زراعي معتمدة.

## ملاحظات أمنية

- حطّ كل الأسرار في `.env` ومتشاركهاش أبدًا (ملف `.env` متجاهَل من Git).
- خدمة الاستدلال تربط على `127.0.0.1` فقط ولا تُعرَّض للخارج.
- ملفات النموذج (`.pt`) والبيانات المُستخرجة والـ dataset zip كلها متجاهَلة من Git.
