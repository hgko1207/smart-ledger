"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">할부 관리</h1>
            <p className="text-gray-400">진행 중인 할부 현황</p>
          </div>
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={handleMonthChange}
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <p className="text-gray-400">로딩 중...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchData()}
                className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : data ? (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">진행 중</p>
                <p className="text-2xl font-bold text-orange-400">{data.activeCount}건</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">총 잔액</p>
                <p className="text-2xl font-bold text-red-400">{formatKRW(data.totalRemaining)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">월 납부액</p>
                <p className="text-2xl font-bold text-yellow-400">{formatKRW(data.monthlyPaymentTotal)}</p>
              </div>
            </div>

            {/* 진행 중 할부 테이블 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">진행 중 할부</h2>
              {data.activeInstallments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">진행 중인 할부가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">가맹점</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">할부기간</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">현재회차</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">남은개월</th>
                        <th className="text-right text-sm text-gray-400 font-medium px-4 py-2">월 납부액</th>
                        <th className="text-right text-sm text-gray-400 font-medium px-4 py-2">남은잔액</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">완료예정</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2 min-w-[120px]">진행률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeInstallments.map((item) => {
                        const progress = (item.installmentCurrent / item.installmentTotal) * 100;
                        return (
                          <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-xs text-gray-500">{formatDate(item.date)}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-300">
                              {item.installmentTotal}개월
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-300">
                              {item.installmentCurrent}/{item.installmentTotal}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className="text-orange-400 font-medium">{item.remainingMonths}개월</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-yellow-400">
                              {formatKRW(item.estimatedMonthlyPayment)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-red-400">
                              {formatKRW(item.installmentRemaining)}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-300">
                              {formatYearMonth(item.completionDate)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-800 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right">
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
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h2 className="text-lg font-semibold">
                    완료된 할부 ({data.completedInstallments.length}건)
                  </h2>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showCompleted ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCompleted && (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">가맹점</th>
                          <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">할부기간</th>
                          <th className="text-right text-sm text-gray-400 font-medium px-4 py-2">월 납부액</th>
                          <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">완료일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.completedInstallments.map((item) => (
                          <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors opacity-60">
                            <td className="px-4 py-3 text-sm">{item.description}</td>
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
