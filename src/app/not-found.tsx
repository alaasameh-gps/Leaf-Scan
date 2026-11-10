import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-green-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">الصفحة غير موجودة</h1>
        <p className="text-gray-600 mb-8">عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition font-medium"
        >
          <Home size={18} />
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}