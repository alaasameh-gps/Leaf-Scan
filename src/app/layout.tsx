import "../../styles/globals.css";
import React from "react";
import ToasterProvider from "../components/Toaster";
import Navbar from "../components/Navbar";

export const metadata = {
  title: "عين النبات | LeafScan",
  description:
    "حلّل أوراق نباتاتك بالذكاء الاصطناعي: توقع الأمراض من 39 فئة مع معلومات نباتية موثقة من GBIF وويكيبيديا.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ ["--primary" as any]: "#16a34a", ["--primary-dark" as any]: "#15803d" } as React.CSSProperties}>
        <ToasterProvider>
          <Navbar />
          <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>
        </ToasterProvider>
      </body>
    </html>
  );
}
