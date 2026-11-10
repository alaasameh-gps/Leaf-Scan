"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, User, Menu, X, LogOut } from "lucide-react";
import axios from "axios";

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function fetchUser() {
      try {
        const res = await axios.get("/api/auth/me", { withCredentials: true });
        if (!active) return;
        if (res.data?.success) {
          setUser(res.data.data.user);
        }
      } catch (err) {
        // User not logged in
      }
    }
    fetchUser();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout", {}, { withCredentials: true });
      setUser(null);
      router.push("/");
    } catch (err) {
      console.error("Logout failed");
    }
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-green-700">
            <Leaf size={26} className="text-green-600" />
            <span>عين النبات</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-700 hover:text-green-600 transition font-medium">
              الرئيسية
            </Link>
            <Link href="/plant" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
              تحليل النبات
            </Link>

            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg hover:bg-green-100 transition">
                  <User size={20} className="text-green-600" />
                  <span className="text-gray-700 font-medium">{user.name}</span>
                </button>

                <div className="absolute right-0 mt-0 w-48 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition duration-200">
                  <button
                    onClick={handleLogout}
                    className="w-full text-right px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut size={18} />
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-green-600 transition font-medium">
                  تسجيل دخول
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-2 border-2 border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition font-medium"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-gray-700 hover:text-green-600 transition"
            aria-label="القائمة"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden mt-4 space-y-3 pb-4">
            <Link href="/" className="block px-4 py-2 text-gray-700 hover:bg-green-50 rounded-lg transition">
              الرئيسية
            </Link>
            <Link href="/plant" className="block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center font-medium">
              تحليل النبات
            </Link>

            {user ? (
              <button
                onClick={handleLogout}
                className="w-full text-right px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                تسجيل الخروج
              </button>
            ) : (
              <>
                <Link href="/login" className="block px-4 py-2 text-gray-700 hover:bg-green-50 rounded-lg transition">
                  تسجيل دخول
                </Link>
                <Link
                  href="/register"
                  className="block px-4 py-2 border-2 border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition text-center font-medium"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
