"use client";

import { useState, useEffect, useCallback } from "react";
import type { Income, Saving } from "@/db/schema";
import { INCOME_SOURCE_COLORS as SOURCE_COLORS } from "@/lib/theme/colors";
import { formatKRW, formatDate, getMonthOptions } from "@/lib/format";

type IncomeSource = "salary" | "bonus" | "freelance" | "tax_refund" | "investment" | "allowance" | "other";

const SOURCE_LABELS: Record<string, string> = {
  salary: "월급",
  bonus: "보너스",
  freelance: "프리랜서/알바",
  tax_refund: "연말정산/환급",
  investment: "투자수익",
  allowance: "용돈/지원금",
  other: "기타",
};

function getSavingPeriodMonths(startDate: string, endDate: string | null): string {
  if (!endDate) return "만기 미정";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months <= 0) return "1개월 미만";
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    return remainMonths > 0 ? `${years}년 ${remainMonths}개월` : `${years}년`;
  }
  return `${months}개월`;
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
  const [incomeSource, setIncomeSource] = useState<IncomeSource>("salary");
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

  // 편집 상태
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editIncomeData, setEditIncomeData] = useState<{
    date: string;
    source: IncomeSource;
    amount: string;
    description: string;
  }>({ date: "", source: "salary", amount: "", description: "" });
  const [editingIncomeSubmitting, setEditingIncomeSubmitting] = useState(false);

  const [editingSavingId, setEditingSavingId] = useState<string | null>(null);
  const [editSavingData, setEditSavingData] = useState<{
    name: string;
    monthlyAmount: string;
    startDate: string;
    endDate: string;
  }>({ name: "", monthlyAmount: "", startDate: "", endDate: "" });
  const [editingSavingSubmitting, setEditingSavingSubmitting] = useState(false);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [incomeRes, savingsRes] = await Promise.all([
        fetch(`/api/income?year=${selectedYear}&month=${selectedMonth}`, { cache: "no-store" }),
        fetch("/api/savings", { cache: "no-store" }),
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

      // 입력 날짜의 월이 현재 탭과 다르면 자동 이동 (useEffect가 fetchData 재호출)
      const d = new Date(incomeDate);
      const submittedYear = d.getFullYear();
      const submittedMonth = d.getMonth() + 1;
      if (submittedYear !== selectedYear || submittedMonth !== selectedMonth) {
        setSelectedYear(submittedYear);
        setSelectedMonth(submittedMonth);
      } else {
        void fetchData();
      }
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

  function startEditIncome(inc: Income) {
    setEditingIncomeId(inc.id);
    setEditIncomeData({
      date: inc.date,
      source: inc.source as IncomeSource,
      amount: String(inc.amount),
      description: inc.description ?? "",
    });
  }

  function cancelEditIncome() {
    setEditingIncomeId(null);
  }

  async function handleIncomeEditSave() {
    if (!editingIncomeId) return;
    setEditingIncomeSubmitting(true);
    try {
      const res = await fetch("/api/income", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingIncomeId,
          date: editIncomeData.date,
          source: editIncomeData.source,
          amount: parseInt(editIncomeData.amount.replace(/,/g, ""), 10),
          description: editIncomeData.description || null,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setEditingIncomeId(null);

      // 수정 후 날짜의 월이 현재 탭과 다르면 자동 이동
      const d = new Date(editIncomeData.date);
      const editedYear = d.getFullYear();
      const editedMonth = d.getMonth() + 1;
      if (editedYear !== selectedYear || editedMonth !== selectedMonth) {
        setSelectedYear(editedYear);
        setSelectedMonth(editedMonth);
      } else {
        void fetchData();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "수입 수정에 실패했습니다.";
      alert(message);
    } finally {
      setEditingIncomeSubmitting(false);
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

  function startEditSaving(s: Saving) {
    setEditingSavingId(s.id);
    setEditSavingData({
      name: s.name,
      monthlyAmount: String(s.monthlyAmount),
      startDate: s.startDate,
      endDate: s.endDate ?? "",
    });
  }

  function cancelEditSaving() {
    setEditingSavingId(null);
  }

  async function handleSavingEditSave() {
    if (!editingSavingId) return;
    setEditingSavingSubmitting(true);
    try {
      const res = await fetch("/api/savings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSavingId,
          name: editSavingData.name,
          monthlyAmount: parseInt(editSavingData.monthlyAmount.replace(/,/g, ""), 10),
          startDate: editSavingData.startDate,
          endDate: editSavingData.endDate || null,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setEditingSavingId(null);
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "적금 수정에 실패했습니다.";
      alert(message);
    } finally {
      setEditingSavingSubmitting(false);
    }
  }

  const totalIncome = incomeList.reduce((sum, inc) => sum + inc.amount, 0);
  const totalMonthlySavings = savingsList
    .filter((s) => !s.endDate || new Date(s.endDate) >= new Date())
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
  const savingsRate = totalIncome > 0 ? (totalMonthlySavings / totalIncome) * 100 : 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">수입 / 저축</h1>
            <p className="text-gray-400 text-sm mt-1">수입을 관리하고 저축 현황을 한눈에 확인하세요</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={handleMonthChange}
              aria-label="조회 월 선택"
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((opt) => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
            <a
              href="/"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white transition-colors"
              aria-label="대시보드로 이동"
            >
              대시보드
            </a>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchData()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-white text-sm"
                aria-label="데이터 다시 불러오기"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <p className="text-sm text-gray-400">이번 달 수입</p>
                </div>
                <p className="text-2xl font-bold text-green-400">{formatKRW(totalIncome)}</p>
                <p className="text-xs text-gray-500 mt-1">{incomeList.length}건의 수입</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <p className="text-sm text-gray-400">월 적금 합계</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{formatKRW(totalMonthlySavings)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {savingsList.filter((s) => !s.endDate || new Date(s.endDate) >= new Date()).length}개 진행중
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <p className="text-sm text-gray-400">저축률</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : "---"}
                </p>
                {totalIncome > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>0%</span>
                      <span>{savingsRate.toFixed(1)}%</span>
                      <span>100%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-[width] duration-500 ${
                          savingsRate >= 30 ? "bg-green-500" : savingsRate >= 15 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(savingsRate, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 수입 섹션 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">수입 목록</h2>
                  <p className="text-xs text-gray-500 mt-0.5">클릭하여 인라인 편집</p>
                </div>
                <button
                  onClick={() => setShowIncomeForm(!showIncomeForm)}
                  aria-label={showIncomeForm ? "수입 추가 폼 닫기" : "새 수입 추가"}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    showIncomeForm
                      ? "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {showIncomeForm ? "취소" : "수입 추가"}
                </button>
              </div>

              {/* 수입 입력 폼 */}
              {showIncomeForm && (
                <form onSubmit={(e) => void handleIncomeSubmit(e)} className="bg-gray-200 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/50 rounded-xl p-5 mb-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        금액 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={incomeAmount}
                        onChange={(e) => setIncomeAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="3,000,000"
                        required
                        aria-label="수입 금액 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        날짜 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={incomeDate}
                        onChange={(e) => setIncomeDate(e.target.value)}
                        required
                        aria-label="수입 날짜 선택"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        유형 <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={incomeSource}
                        onChange={(e) => setIncomeSource(e.target.value as IncomeSource)}
                        aria-label="수입 유형 선택"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">설명</label>
                      <input
                        type="text"
                        value={incomeDesc}
                        onChange={(e) => setIncomeDesc(e.target.value)}
                        placeholder="선택 입력"
                        aria-label="수입 설명 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={incomeSubmitting}
                    aria-label="수입 저장"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {incomeSubmitting ? "저장 중..." : "저장"}
                  </button>
                </form>
              )}

              {/* 수입 목록 */}
              {incomeList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">이번 달 수입 데이터가 없습니다.</p>
                  <p className="text-gray-500 text-xs mt-1">위의 &quot;수입 추가&quot; 버튼을 눌러 수입을 등록해보세요.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" aria-label="수입 목록 테이블">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">날짜</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">유형</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">금액</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">설명</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                      {incomeList.map((inc) => (
                        editingIncomeId === inc.id ? (
                          <tr key={inc.id} className="bg-gray-100 dark:bg-gray-800/40">
                            <td className="px-4 py-3">
                              <input
                                type="date"
                                value={editIncomeData.date}
                                onChange={(e) => setEditIncomeData({ ...editIncomeData, date: e.target.value })}
                                aria-label="수입 날짜 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={editIncomeData.source}
                                onChange={(e) => setEditIncomeData({ ...editIncomeData, source: e.target.value as IncomeSource })}
                                aria-label="수입 유형 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              >
                                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editIncomeData.amount}
                                onChange={(e) => setEditIncomeData({ ...editIncomeData, amount: e.target.value.replace(/[^0-9,]/g, "") })}
                                aria-label="수입 금액 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editIncomeData.description}
                                onChange={(e) => setEditIncomeData({ ...editIncomeData, description: e.target.value })}
                                aria-label="수입 설명 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => void handleIncomeEditSave()}
                                  disabled={editingIncomeSubmitting}
                                  aria-label="수입 수정 저장"
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={cancelEditIncome}
                                  aria-label="수입 수정 취소"
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors"
                                >
                                  취소
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={inc.id}
                            className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                            onClick={() => startEditIncome(inc)}
                          >
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(inc.date)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                SOURCE_COLORS[inc.source] ?? "bg-gray-500/20 text-gray-300"
                              }`}>
                                {SOURCE_LABELS[inc.source] ?? inc.source}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-green-400 font-medium">
                              {formatKRW(inc.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {inc.description ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => void handleIncomeDelete(inc.id)}
                                aria-label={`${SOURCE_LABELS[inc.source] ?? inc.source} ${formatKRW(inc.amount)} 수입 삭제`}
                                className="text-gray-500 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 적금 섹션 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">적금 관리</h2>
                  <p className="text-xs text-gray-500 mt-0.5">클릭하여 편집</p>
                </div>
                <button
                  onClick={() => setShowSavingsForm(!showSavingsForm)}
                  aria-label={showSavingsForm ? "적금 추가 폼 닫기" : "새 적금 추가"}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    showSavingsForm
                      ? "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {showSavingsForm ? "취소" : "적금 추가"}
                </button>
              </div>

              {/* 적금 입력 폼 */}
              {showSavingsForm && (
                <form onSubmit={(e) => void handleSavingsSubmit(e)} className="bg-gray-200 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/50 rounded-xl p-5 mb-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        적금명 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={savingsName}
                        onChange={(e) => setSavingsName(e.target.value)}
                        placeholder="청약저축"
                        required
                        aria-label="적금명 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        월 납입액 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={savingsAmount}
                        onChange={(e) => setSavingsAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="500,000"
                        required
                        aria-label="월 납입액 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        시작일 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={savingsStartDate}
                        onChange={(e) => setSavingsStartDate(e.target.value)}
                        required
                        aria-label="적금 시작일 선택"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">종료일</label>
                      <input
                        type="date"
                        value={savingsEndDate}
                        onChange={(e) => setSavingsEndDate(e.target.value)}
                        aria-label="적금 종료일 선택 (선택사항)"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingsSubmitting}
                    aria-label="적금 저장"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingsSubmitting ? "저장 중..." : "저장"}
                  </button>
                </form>
              )}

              {/* 적금 목록 */}
              {savingsList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">등록된 적금이 없습니다.</p>
                  <p className="text-gray-500 text-xs mt-1">위의 &quot;적금 추가&quot; 버튼을 눌러 적금을 등록해보세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savingsList.map((s) => {
                    const isActive = !s.endDate || new Date(s.endDate) >= new Date();

                    if (editingSavingId === s.id) {
                      return (
                        <div key={s.id} className="bg-gray-200 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/50 rounded-xl p-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1.5">
                                적금명 <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={editSavingData.name}
                                onChange={(e) => setEditSavingData({ ...editSavingData, name: e.target.value })}
                                aria-label="적금명 수정"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1.5">
                                월 납입액 <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={editSavingData.monthlyAmount}
                                onChange={(e) => setEditSavingData({ ...editSavingData, monthlyAmount: e.target.value.replace(/[^0-9,]/g, "") })}
                                aria-label="월 납입액 수정"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1.5">
                                시작일 <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="date"
                                value={editSavingData.startDate}
                                onChange={(e) => setEditSavingData({ ...editSavingData, startDate: e.target.value })}
                                aria-label="적금 시작일 수정"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1.5">종료일</label>
                              <input
                                type="date"
                                value={editSavingData.endDate}
                                onChange={(e) => setEditSavingData({ ...editSavingData, endDate: e.target.value })}
                                aria-label="적금 종료일 수정 (선택사항)"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void handleSavingEditSave()}
                              disabled={editingSavingSubmitting}
                              aria-label="적금 수정 저장"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                            >
                              {editingSavingSubmitting ? "저장 중..." : "저장"}
                            </button>
                            <button
                              onClick={cancelEditSaving}
                              aria-label="적금 수정 취소"
                              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={s.id}
                        className={`group flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl cursor-pointer transition-colors border ${
                          isActive
                            ? "bg-gray-100 dark:bg-gray-800/40 hover:bg-gray-200 dark:hover:bg-gray-800/60 border-gray-200 dark:border-gray-800"
                            : "bg-gray-50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/30 border-gray-200 dark:border-gray-800/50"
                        }`}
                        onClick={() => startEditSaving(s)}
                      >
                        <div className="flex items-start gap-3 mb-2 sm:mb-0">
                          <div className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                            isActive ? "bg-green-500" : "bg-gray-600"
                          }`} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isActive
                                  ? "bg-green-500/20 text-green-300 border border-green-500/20"
                                  : "bg-gray-500/15 text-gray-500 border border-gray-600/20"
                              }`}>
                                {isActive ? "진행중" : "완료"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getSavingPeriodMonths(s.startDate, s.endDate)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(s.startDate)}
                              {s.endDate ? ` ~ ${formatDate(s.endDate)}` : " ~ 진행중"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pl-6 sm:pl-0">
                          <span className="font-mono text-blue-400 font-medium">
                            월 {formatKRW(s.monthlyAmount)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleSavingsDelete(s.id); }}
                            aria-label={`${s.name} 적금 삭제`}
                            className="text-gray-500 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
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
