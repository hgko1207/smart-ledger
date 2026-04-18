"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CashOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="16" height="12" rx="2" />
      <circle cx="10" cy="12" r="3" />
      <path d="M18 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M22 12l-2-2m2 2l-2 2" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const navGroups: NavGroup[] = [
  {
    label: "한눈에 보기",
    items: [
      { href: "/", label: "대시보드", icon: <HomeIcon className="w-5 h-5" /> },
    ],
  },
  {
    label: "돈 관리",
    items: [
      { href: "/expenses", label: "지출 내역", icon: <ListIcon className="w-5 h-5" /> },
      { href: "/income", label: "수입/저축", icon: <WalletIcon className="w-5 h-5" /> },
      { href: "/manual-expenses", label: "기타 지출", icon: <CashOutIcon className="w-5 h-5" /> },
      { href: "/installments", label: "할부", icon: <CreditCardIcon className="w-5 h-5" /> },
    ],
  },
  {
    label: "도구",
    items: [
      { href: "/analytics", label: "분석", icon: <ChartIcon className="w-5 h-5" /> },
      { href: "/upload", label: "업로드", icon: <UploadIcon className="w-5 h-5" /> },
      { href: "/annual-report", label: "연간 리포트", icon: <CalendarIcon className="w-5 h-5" /> },
    ],
  },
];

const bottomNavItems: NavItem[] = [
  { href: "/settings", label: "설정", icon: <SettingsIcon className="w-5 h-5" /> },
];

// 모바일 하단 탭바: 주요 5개만
const mobileTabItems: NavItem[] = [
  { href: "/", label: "대시보드", icon: <HomeIcon className="w-5 h-5" /> },
  { href: "/expenses", label: "지출 내역", icon: <ListIcon className="w-5 h-5" /> },
  { href: "/income", label: "수입/저축", icon: <WalletIcon className="w-5 h-5" /> },
  { href: "/manual-expenses", label: "기타 지출", icon: <CashOutIcon className="w-5 h-5" /> },
  { href: "/analytics", label: "분석", icon: <ChartIcon className="w-5 h-5" /> },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Navigation() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);
  const [subtitle, setSubtitle] = useState("가족 가계부");

  const syncSubtitle = useCallback(() => {
    try {
      const stored = localStorage.getItem("smart-ledger-subtitle");
      if (stored) setSubtitle(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Initialize theme state from DOM
    const hasDark = document.documentElement.classList.contains("dark");
    setIsDark(hasDark);

    // Initialize subtitle from localStorage
    syncSubtitle();

    // Listen for subtitle changes from other tabs or custom events
    function handleStorage(e: StorageEvent) {
      if (e.key === "smart-ledger-subtitle" && e.newValue) {
        setSubtitle(e.newValue);
      }
    }
    function handleSubtitleChange() {
      syncSubtitle();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("smart-ledger-subtitle-changed", handleSubtitleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("smart-ledger-subtitle-changed", handleSubtitleChange);
    };
  }, [syncSubtitle]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("smart-ledger-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("smart-ledger-theme", "light");
    }
  }

  // 로그인 페이지에서는 네비게이션 숨김
  if (pathname === "/login") return null;

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 z-40">
        {/* 로고 */}
        <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            Smart Ledger
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 px-4 pt-6 pb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      <span className={active ? "text-white" : "text-gray-400 dark:text-gray-500"}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 메뉴 + 테마 토글 */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          <div className="px-3 py-3 space-y-1">
            {bottomNavItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <span className={active ? "text-white" : "text-gray-400 dark:text-gray-500"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
            >
              <span className="text-gray-400 dark:text-gray-500">
                {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </span>
              {isDark ? "라이트 모드" : "다크 모드"}
            </button>
          </div>
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-600">v1.0</p>
          </div>
        </div>
      </aside>

      {/* 모바일 하단 탭 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {mobileTabItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-2 min-h-[48px] min-w-0 transition-colors ${
                  active ? "text-blue-500" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {item.icon}
                <span className="text-xs font-medium truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
