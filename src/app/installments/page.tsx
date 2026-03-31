"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface InstallmentItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  installmentTotal: number;
  installmentCurrent: number;
  installmentRemaining: number;
  remainingMonths: number;
  estimatedMonthlyPayment: number;
  completionDate: string;
  isCompleted: boolean;
}

interface InstallmentsResponse {
  activeInstallments: InstallmentItem[];
  completedInstallments: InstallmentItem[];
  totalRemaining: number;
  monthlyPaymentTotal: number;
  activeCount: number;
}

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

function getMonthOptions(): { year: number; month: number; label: string }[] {
  const options: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
    });
  }
  return options;
}

export default function InstallmentsPage() {
  const now = new Date();
  const searchParams = useSearchParams();
  const paramYear = searchParams.get("year");
  const paramMonth = searchParams.get("month");
  const [selectedYear, setSelectedYear] = useState(paramYear ? parseInt(paramYear, 10) : now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(paramMonth ? parseInt(paramMonth, 10) : now.getMonth() + 1);
  const [data, setData] = useState<InstallmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/installments?year=${selectedYear}&month=${selectedMonth}`
      );
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const json = (await res.json()) as InstallmentsResponse;
      setData(json);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "데이터 로딩에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-");
    setSelectedYear(parseInt(y, 10));
    setSelectedMonth(parseInt(m, 10));
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">할부 관리</h1>
            <p className="text-gray-400 text-sm mt-1">진행 중인 할부 현황과 납부 일정을 관리합니다</p>
          </div>
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={handleMonthChange}
            aria-label="월 선택"
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthOptions.map((opt) => (
              <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24" aria-label="로딩">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-400">할부 내역을 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <svg className="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchData()}
                aria-label="다시 시도"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : data ? (
          <>
            {/* 요약 카드 3개 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">진행 중</p>
                </div>
                <p className="text-2xl font-bold text-orange-400">{data.activeCount}<span className="text-lg font-normal text-gray-400 ml-1">건</span></p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">총 잔액</p>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatKRW(data.totalRemaining)}</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">월 납부액</p>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{formatKRW(data.monthlyPaymentTotal)}</p>
              </div>
            </div>

            {/* 진행 중 할부 테이블 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">진행 중 할부</h2>
              {data.activeInstallments.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-400">진행 중인 할부가 없습니다</p>
                  <p className="text-gray-500 text-sm mt-1">이번 달에는 할부 내역이 없어요</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800/50">
                        <th className="text-left text-xs text-gray-400 font-medium px-4 py-3 rounded-l-lg">가맹점</th>
                        <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">할부기간</th>
                        <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">현재회차</th>
                        <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">남은개월</th>
                        <th className="text-right text-xs text-gray-400 font-medium px-4 py-3">월 납부액</th>
                        <th className="text-right text-xs text-gray-400 font-medium px-4 py-3">남은잔액</th>
                        <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">완료예정</th>
                        <th className="text-center text-xs text-gray-400 font-medium px-4 py-3 min-w-[140px] rounded-r-lg">진행률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeInstallments.map((item) => {
                        const progress = (item.installmentCurrent / item.installmentTotal) * 100;
                        return (
                          <tr key={item.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3.5 text-sm">
                              <div className="font-medium text-gray-900 dark:text-white">{item.description}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.date)}</div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-center text-gray-700 dark:text-gray-300">
                              {item.installmentTotal}개월
                            </td>
                            <td className="px-4 py-3.5 text-sm text-center">
                              <span className="text-gray-900 dark:text-white font-medium">{item.installmentCurrent}</span>
                              <span className="text-gray-500">/{item.installmentTotal}</span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-medium text-xs">
                                {item.remainingMonths}개월
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-right font-mono text-yellow-400">
                              {formatKRW(item.estimatedMonthlyPayment)}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-right font-mono text-red-400">
                              {formatKRW(item.installmentRemaining)}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-center text-gray-700 dark:text-gray-300">
                              {formatYearMonth(item.completionDate)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className="h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-500"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right font-mono">
                                  {Math.round(progress)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 완료된 할부 */}
            {data.completedInstallments.length > 0 && (
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  aria-expanded={showCompleted}
                  aria-label={showCompleted ? "완료된 할부 접기" : "완료된 할부 펼기"}
                  className="flex items-center justify-between w-full text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      완료된 할부
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        {data.completedInstallments.length}건
                      </span>
                    </h2>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 group-hover:text-gray-300 ${showCompleted ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCompleted && (
                  <div className="overflow-x-auto mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800/50">
                          <th className="text-left text-xs text-gray-400 font-medium px-4 py-3 rounded-l-lg">가맹점</th>
                          <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">할부기간</th>
                          <th className="text-right text-xs text-gray-400 font-medium px-4 py-3">월 납부액</th>
                          <th className="text-center text-xs text-gray-400 font-medium px-4 py-3 rounded-r-lg">완료일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.completedInstallments.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-400">
                              {item.installmentTotal}개월
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-400">
                              {formatKRW(item.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-400">
                              {formatDate(item.date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
