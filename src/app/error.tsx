"use client"
import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-4 w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle size={36} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">حدث خطأ ما</h1>
        <p className="text-gray-600 mb-8">نعتذر عن هذا الخلل، يرجى المحاولة مرة أخرى.</p>
        <div className="flex items-center justify-center gap-3">
          {typeof reset === 'function' && (
            <button
              onClick={() => reset()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition font-medium"
            >
              إعادة المحاولة
            </button>
          )}
          <Link href="/" className="text-indigo-600 hover:underline font-medium px-2 py-3">
            العودة للرئيسية
          </Link>
        </div>
        {process.env.NODE_ENV !== 'production' && error?.message && (
          <p className="mt-6 text-xs text-gray-400 text-left" dir="ltr">{error.message}</p>
        )}
      </div>
    </div>
  );
}