import React from "react";
import PlantAnalyzer from "../../components/plant/PlantAnalyzer";

export const metadata = {
  title: "تحليل أمراض أوراق النبات | Plant leaf analysis",
  description:
    "ارفع صورة ورقة نبات أو التقط صورة بالكاميرا للتعرف على الفئة المتوقعة من 39 فئة مرضية، مع معلومات نباتية موثقة من GBIF وويكيبيديا.",
};

export default function PlantPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-green-50 to-white py-10">
      <div className="container mx-auto px-4">
        <PlantAnalyzer />

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            نطاق الدعم وحدود الاستخدام | Supported scope and limits
          </h2>
          <ul className="list-disc ps-5 space-y-1">
            <li>
              النموذج مدرَّب على 39 فئة محددة (محاصيل وأمراض أوراق) من مجموعة بيانات Mendeley
              &quot;Identification of Plant Leaf Diseases Using a 9-layer DCNN&quot; — وليس قاعدة معرفة لكل أنواع
              النباتات.
            </li>
            <li>
              النتائج توقعات إحصائية وليست تشخيصًا نهائيًا، وقد تكون خاطئة خصوصًا مع الصور غير الواضحة أو الفئات غير
              المدعومة.
            </li>
            <li>
              معلومات التصنيف والانتشار يتم جلبها مباشرة من GBIF، والنصوص التوضيحية من ويكيبيديا، مع روابط المصادر. لا
              يقوم الموقع بتأليف أسماء علمية أو استخدامات طبية.
            </li>
            <li>
              لا يقدم الموقع توصيات بالمبيدات أو العلاج؛ راجع جهة إرشاد زراعي معتمدة.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
