import React from "react";
import Link from "next/link";
import { Leaf, Camera, Search, BookOpen, Upload, AlertTriangle, Globe, Zap } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    titleAr: "ارفع صورة أو التقطها",
    titleEn: "Upload or capture",
    descAr: "اختر صورة ورقة من جهازك، أو استخدم الكاميرا مباشرة من المتصفح.",
    descEn: "Pick a leaf photo from your device, or use the in-browser camera.",
  },
  {
    icon: Search,
    titleAr: "تنبؤ بالفئة",
    titleEn: "Predict the class",
    descAr: "نموذج تعلّم عميق (MobileNetV3) يتنبأ بأحد 39 فئة مرضية مع درجة الثقة.",
    descEn: "A deep model (MobileNetV3) predicts one of 39 disease classes with a confidence score.",
  },
  {
    icon: BookOpen,
    titleAr: "معلومات موثّقة",
    titleEn: "Sourced facts",
    descAr: "تصنيف علمي من GBIF ونصوص من ويكيبيديا، مع روابط لكل مصدر.",
    descEn: "Taxonomy from GBIF and text from Wikipedia, with a link for every source.",
  },
];

const CROPS = [
  "تفاح / Apple",
  "بطاطس / Potato",
  "طماطم / Tomato",
  "ذرة / Corn",
  "عنب / Grape",
  "برتقال / Orange",
  "خوخ / Peach",
  "فلفل / Bell pepper",
  "فراولة / Strawberry",
  "توت أزرق / Blueberry",
  "كرز / Cherry",
  "توت العليق / Raspberry",
  "صويا / Soybean",
  "قرع / Squash",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-white">
      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-800 px-4 py-1 text-sm font-medium mb-6">
          <Leaf size={16} /> مدعوم بالذكاء الاصطناعي
        </span>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          عين <span className="text-green-600">النبات</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          حلّل أوراق نباتاتك بالذكاء الاصطناعي: ارفع صورة أو التقطها بالكاميرا، واحصل على تنبؤ بالمرض من{" "}
          <strong>39 فئة</strong> مع معلومات نباتية موثّقة ومصادر موثوقة.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/plant"
            className="px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-bold text-lg inline-flex items-center gap-2 justify-center"
          >
            <Camera size={20} /> ابدأ التحليل الآن
          </Link>
          <Link
            href="/plant"
            className="px-8 py-4 border-2 border-green-600 text-green-700 rounded-xl hover:bg-green-50 transition font-bold text-lg"
          >
            شاهد الفئات المدعومة
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-14">كيف يعمل؟</h2>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {STEPS.map((step) => (
              <div key={step.titleEn} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <step.icon size={28} className="text-green-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.titleAr}</h3>
                <p className="text-sm text-gray-500 mb-1" dir="ltr">
                  {step.titleEn}
                </p>
                <p className="text-gray-600 leading-relaxed">{step.descAr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported crops */}
      <section className="py-20 bg-green-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">المحاصيل المدعومة</h2>
          <p className="text-gray-600 mb-10 max-w-2xl mx-auto">
            النموذج مدرَّب على 39 فئة تغطي 14 محصولًا وأمراضها، إضافة إلى فئة بدون أوراق.
          </p>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {CROPS.map((crop) => (
              <span
                key={crop}
                className="rounded-full bg-white border border-green-200 px-4 py-2 text-sm text-gray-700 shadow-sm"
              >
                {crop}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Scope + limits */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 grid gap-10 md:grid-cols-2 max-w-5xl">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Globe size={22} className="text-green-600" /> معلومات موثّقة ومفتوحة
            </h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li className="flex gap-2">
                <Zap size={18} className="text-green-600 mt-1 shrink-0" /> التصنيف العلمي (العائلة، الجنس، النوع) يُجلب مباشرة من قاعدة GBIF.
              </li>
              <li className="flex gap-2">
                <Zap size={18} className="text-green-600 mt-1 shrink-0" /> النصوص التوضيحية للنبات والمرض من ويكيبيديا، مع رابط لكل مصدر.
              </li>
              <li className="flex gap-2">
                <Zap size={18} className="text-green-600 mt-1 shrink-0" /> مساعد أسئلة يجيب من النصوص المسترجعة فقط، ولا يُلفّق حقائق.
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle size={22} className="text-amber-600" /> حدود الاستخدام
            </h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li className="flex gap-2">
                <AlertTriangle size={18} className="text-amber-600 mt-1 shrink-0" /> النتائج تنبؤات احتمالية على 39 فئة، وليست تشخيصًا نهائيًا.
              </li>
              <li className="flex gap-2">
                <AlertTriangle size={18} className="text-amber-600 mt-1 shrink-0" /> قد تخطئ مع الصور غير الواضحة أو النباتات خارج الفئات المدعومة.
              </li>
              <li className="flex gap-2">
                <AlertTriangle size={18} className="text-amber-600 mt-1 shrink-0" /> لا نقدّم توصيات بالمبيدات أو العلاج؛ استشر جهة إرشاد زراعي معتمدة.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-green-600 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">جاهز لفحص نباتك؟</h2>
          <p className="text-green-100 mb-8 max-w-xl mx-auto">
            جرّبها الآن — تحتاج فقط صورة واضحة لورقة نبات في إضاءة جيدة.
          </p>
          <Link
            href="/plant"
            className="px-8 py-4 bg-white text-green-700 rounded-xl hover:bg-green-50 transition font-bold text-lg inline-flex items-center gap-2"
          >
            <Leaf size={20} /> ابدأ التحليل
          </Link>
        </div>
      </section>
    </div>
  );
}
