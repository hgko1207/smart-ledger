"use client";

import { useState, useEffect, useCallback } from "react";
import type { Income, Saving } from "@/db/schema";

const SOURCE_LABELS: Record<string, string> = {
  salary: "월급",
  bonus: "보너스",
  other: "기타",
};

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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

export default function IncomePage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [savingsList, setSavingsList] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 수입 입력 폼
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [incomeSource, setIncomeSource] = useState<"salary" | "bonus" | "other">("salary");
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);

  // 적금 입력 폼
  const [savingsName, setSavingsName] = useState("");
  const [savingsAmount, setSavingsAmount] = useState("");
  const [savingsStartDate, setSavingsStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [savingsEndDate, setSavingsEndDate] = useState("");
  const [savingsSubmitting, setSavingsSubmitting] = useState(false);

  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showSavingsForm, setShowSavingsForm] = useState(false);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [incomeRes, savingsRes] = await Promise.all([
        fetch(`/api/income?year=${selectedYear}&month=${selectedMonth}`),
        fetch("/api/savings"),
      ]);

      if (!incomeRes.ok) {
        const errData = (await incomeRes.json()) as { error: string };
        throw new Error(errData.error);
      }
      if (!savingsRes.ok) {
        const errData = (await savingsRes.json()) as { error: string };
        throw new Error(errData.error);
      }

      const incomeData = (await incomeRes.json()) as { incomes: Income[] };
      const savingsData = (await savingsRes.json()) as { savings: Saving[] };

      setIncomeList(incomeData.incomes);
      setSavingsList(savingsData.savings);
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

  async function handleIncomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!incomeAmount || !incomeDate) return;

    setIncomeSubmitting(true);
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: incomeDate,
          source: incomeSource,
          amount: parseInt(incomeAmount.replace(/,/g, ""), 10),
          description: incomeDesc || null,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setIncomeAmount("");
      setIncomeDesc("");
      setShowIncomeForm(false);
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "수입 추가에 실패했습니다.";
      alert(message);
    } finally {
      setIncomeSubmitting(false);
    }
  }

  async function handleIncomeDelete(id: string) {
    if (!confirm("이 수입을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/income?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "수입 삭제에 실패했습니다.";
      alert(message);
    }
  }

  async function handleSavingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!savingsName || !savingsAmount || !savingsStartDate) return;

    setSavingsSubmitting(true);
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savingsName,
          monthlyAmount: parseInt(savingsAmount.replace(/,/g, ""), 10),
          startDate: savingsStartDate,
          endDate: savingsEndDate || null,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setSavingsName("");
      setSavingsAmount("");
      setSavingsEndDate("");
      setShowSavingsForm(false);
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "적금 추가에 실패했습니다.";
      alert(message);
    } finally {
      setSavingsSubmitting(false);
    }
  }

  async function handleSavingsDelete(id: string) {
    if (!confirm("이 적금을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/savings?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "적금 삭제에 실패했습니다.";
      alert(message);
    }
  }

  const totalIncome = incomeList.reduce((sum, inc) => sum + inc.amount, 0);
  const totalMonthlySavings = savingsList
    .filter((s) => !s.endDate || new Date(s.endDate) >= new Date())
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
  const savingsRate = totalIncome > 0 ? (totalMonthlySavings / totalIncome) * 100 : 0;

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">수입 / 저축</h1>
            <p className="text-gray-400">수입 관리 및 저축 현황</p>
          </div>
          <div className="flex items-center gap-4">
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
            <a
              href="/"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              대시보드
            </a>
          </div>
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
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">이번 달 수입</p>
                <p className="text-2xl font-bold text-green-400">{formatKRW(totalIncome)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">월 적금 합계</p>
                <p className="text-2xl font-bold text-blue-400">{formatKRW(totalMonthlySavings)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1">저축률</p>
                <p className="text-2xl font-bold">
                  {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : "---"}
                </p>
                {totalIncome > 0 && (
                  <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.min(savingsRate, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 수입 섹션 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">수입 목록</h2>
                <button
                  onClick={() => setShowIncomeForm(!showIncomeForm)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {showIncomeForm ? "취소" : "수입 추가"}
                </button>
              </div>

              {/* 수입 입력 폼 */}
              {showIncomeForm && (
                <form onSubmit={(e) => void handleIncomeSubmit(e)} className="bg-gray-800/50 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">금액</label>
                      <input
                        type="text"
                        value={incomeAmount}
                        onChange={(e) => setIncomeAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="3,000,000"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">날짜</label>
                      <input
                        type="date"
                        value={incomeDate}
                        onChange={(e) => setIncomeDate(e.target.value)}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">유형</label>
                      <select
                        value={incomeSource}
                        onChange={(e) => setIncomeSource(e.target.value as "salary" | "bonus" | "other")}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="salary">월급</option>
                        <option value="bonus">보너스</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">설명</label>
                      <input
                        type="text"
                        value={incomeDesc}
                        onChange={(e) => setIncomeDesc(e.target.value)}
                        placeholder="선택 입력"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={incomeSubmitting}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {incomeSubmitting ? "저장 중..." : "저장"}
                  </button>
                </form>
              )}

              {/* 수입 목록 */}
              {incomeList.length === 0 ? (
                <p className="text-gray-500 text-center py-8">이번 달 수입 데이터가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">날짜</th>
                        <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">유형</th>
                        <th className="text-right text-sm text-gray-400 font-medium px-4 py-2">금액</th>
                        <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">설명</th>
                        <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeList.map((inc) => (
                        <tr key={inc.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-2 text-sm text-gray-300">{formatDate(inc.date)}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              inc.source === "salary"
                                ? "bg-green-500/20 text-green-400"
                                : inc.source === "bonus"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}>
                              {SOURCE_LABELS[inc.source] ?? inc.source}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-green-400">
                            {formatKRW(inc.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-400">
                            {inc.description ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => void handleIncomeDelete(inc.id)}
                              className="text-red-400 hover:text-red-300 text-sm transition-colors"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 적금 섹션 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">적금 관리</h2>
                <button
                  onClick={() => setShowSavingsForm(!showSavingsForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {showSavingsForm ? "취소" : "적금 추가"}
                </button>
              </div>

              {/* 적금 입력 폼 */}
              {showSavingsForm && (
                <form onSubmit={(e) => void handleSavingsSubmit(e)} className="bg-gray-800/50 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">적금명</label>
                      <input
                        type="text"
                        value={savingsName}
                        onChange={(e) => setSavingsName(e.target.value)}
                        placeholder="청약저축"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">월 납입액</label>
                      <input
                        type="text"
                        value={savingsAmount}
                        onChange={(e) => setSavingsAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="500,000"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">시작일</label>
                      <input
                        type="date"
                        value={savingsStartDate}
                        onChange={(e) => setSavingsStartDate(e.target.value)}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">종료일 (선택)</label>
                      <input
                        type="date"
                        value={savingsEndDate}
                        onChange={(e) => setSavingsEndDate(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingsSubmitting}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {savingsSubmitting ? "저장 중..." : "저장"}
                  </button>
                </form>
              )}

              {/* 적금 목록 */}
              {savingsList.length === 0 ? (
                <p className="text-gray-500 text-center py-8">등록된 적금이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {savingsList.map((s) => {
                    const isActive = !s.endDate || new Date(s.endDate) >= new Date();
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between p-4 rounded-xl ${
                          isActive ? "bg-gray-800/50" : "bg-gray-800/20"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{s.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isActive
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-gray-500/20 text-gray-500"
                              }`}>
                                {isActive ? "진행중" : "종료"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              {formatDate(s.startDate)}
                              {s.endDate ? ` ~ ${formatDate(s.endDate)}` : " ~"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-blue-400">
                            월 {formatKRW(s.monthlyAmount)}
                          </span>
                          <button
                            onClick={() => void handleSavingsDelete(s.id)}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
