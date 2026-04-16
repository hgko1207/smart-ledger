"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/db/schema";
import { MANUAL_CATEGORY_COLORS as CATEGORY_COLORS } from "@/lib/theme/colors";
import { formatKRW, formatDate, getMonthOptions } from "@/lib/format";

type ManualCategory =
  | "헌금/기부"
  | "용돈/지원"
  | "계모임/회비"
  | "주택대출"
  | "차량대출"
  | "가족대출"
  | "기타대출"
  | "현금지출"
  | "계좌이체"
  | "기타";

const CATEGORIES: ManualCategory[] = [
  "헌금/기부",
  "용돈/지원",
  "계모임/회비",
  "주택대출",
  "차량대출",
  "가족대출",
  "기타대출",
  "현금지출",
  "계좌이체",
  "기타",
];

export default function ManualExpensesPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<ManualCategory>("기타");
  const [formRecurring, setFormRecurring] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    date: string;
    description: string;
    amount: string;
    category: ManualCategory;
    isRecurring: boolean;
  }>({ date: "", description: "", amount: "", category: "기타", isRecurring: false });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/manual-expenses?year=${selectedYear}&month=${selectedMonth}`
      );
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const data = (await res.json()) as { expenses: Transaction[] };
      setExpenses(data.expenses);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formDesc || !formAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate,
          description: formDesc,
          amount: parseInt(formAmount.replace(/,/g, ""), 10),
          category: formCategory,
          isRecurring: formRecurring ? 1 : 0,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setFormDesc("");
      setFormAmount("");
      setFormRecurring(false);
      setShowForm(false);
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 추가에 실패했습니다.";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 지출을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/manual-expenses?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 삭제에 실패했습니다.";
      alert(message);
    }
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditData({
      date: tx.date,
      description: tx.description,
      amount: String(tx.amount),
      category: tx.category as ManualCategory,
      isRecurring: tx.isRecurring === 1,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave() {
    if (!editingId) return;
    setEditSubmitting(true);
    try {
      const res = await fetch("/api/manual-expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          date: editData.date,
          description: editData.description,
          amount: parseInt(editData.amount.replace(/,/g, ""), 10),
          category: editData.category,
          isRecurring: editData.isRecurring ? 1 : 0,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setEditingId(null);
      void fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 수정에 실패했습니다.";
      alert(message);
    } finally {
      setEditSubmitting(false);
    }
  }

  // 요약 계산
  const totalAmount = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const recurringCount = expenses.filter((tx) => tx.isRecurring === 1).length;
  const loanRepayment = expenses
    .filter((tx) => tx.category === "주택대출" || tx.category === "차량대출" || tx.category === "가족대출" || tx.category === "기타대출")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">기타 지출</h1>
            <p className="text-gray-400 text-sm mt-1">카드 외 지출 관리 (헌금, 용돈, 대출 등)</p>
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
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <p className="text-sm text-gray-400">이번 달 합계</p>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatKRW(totalAmount)}</p>
                <p className="text-xs text-gray-500 mt-1">{expenses.length}건의 지출</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <p className="text-sm text-gray-400">고정 지출 건수</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{recurringCount}건</p>
                <p className="text-xs text-gray-500 mt-1">매월 반복 항목</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <p className="text-sm text-gray-400">대출 상환액</p>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{formatKRW(loanRepayment)}</p>
                <p className="text-xs text-gray-500 mt-1">주택/차량/기타 대출 합계</p>
              </div>
            </div>

            {/* 지출 목록 섹션 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">지출 목록</h2>
                  <p className="text-xs text-gray-500 mt-0.5">클릭하여 인라인 편집</p>
                </div>
                <button
                  onClick={() => setShowForm(!showForm)}
                  aria-label={showForm ? "지출 추가 폼 닫기" : "새 지출 추가"}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    showForm
                      ? "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {showForm ? "취소" : "지출 추가"}
                </button>
              </div>

              {/* 추가 폼 */}
              {showForm && (
                <form onSubmit={(e) => void handleSubmit(e)} className="bg-gray-200 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/50 rounded-xl p-5 mb-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        날짜 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        required
                        aria-label="지출 날짜 선택"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        설명 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="교회 헌금, 용돈 등"
                        required
                        aria-label="지출 설명 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">
                        금액 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="100,000"
                        required
                        aria-label="지출 금액 입력"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">카테고리</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as ManualCategory)}
                        aria-label="카테고리 선택"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                        <input
                          type="checkbox"
                          checked={formRecurring}
                          onChange={(e) => setFormRecurring(e.target.checked)}
                          aria-label="매월 반복 여부"
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">매월 반복</span>
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    aria-label="지출 저장"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "저장 중..." : "저장"}
                  </button>
                </form>
              )}

              {/* 지출 목록 */}
              {expenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">이번 달 기타 지출 데이터가 없습니다.</p>
                  <p className="text-gray-500 text-xs mt-1">위의 &quot;지출 추가&quot; 버튼을 눌러 지출을 등록해보세요.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" aria-label="기타 지출 목록 테이블">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">날짜</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">설명</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">금액</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">카테고리</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">반복</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-4 py-3 uppercase tracking-wider">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                      {expenses.map((tx) =>
                        editingId === tx.id ? (
                          <tr key={tx.id} className="bg-gray-100 dark:bg-gray-800/40">
                            <td className="px-4 py-3">
                              <input
                                type="date"
                                value={editData.date}
                                onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                aria-label="지출 날짜 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editData.description}
                                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                aria-label="지출 설명 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editData.amount}
                                onChange={(e) => setEditData({ ...editData, amount: e.target.value.replace(/[^0-9,]/g, "") })}
                                aria-label="지출 금액 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={editData.category}
                                onChange={(e) => setEditData({ ...editData, category: e.target.value as ManualCategory })}
                                aria-label="카테고리 수정"
                                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editData.isRecurring}
                                  onChange={(e) => setEditData({ ...editData, isRecurring: e.target.checked })}
                                  aria-label="매월 반복 수정"
                                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                                />
                              </label>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => void handleEditSave()}
                                  disabled={editSubmitting}
                                  aria-label="지출 수정 저장"
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  aria-label="지출 수정 취소"
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors"
                                >
                                  취소
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={tx.id}
                            className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                            onClick={() => startEdit(tx)}
                          >
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(tx.date)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{tx.description}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-red-400 font-medium">
                              {formatKRW(tx.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                CATEGORY_COLORS[tx.category] ?? "bg-gray-500/20 text-gray-300"
                              }`}>
                                {tx.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              {tx.isRecurring === 1 && (
                                <span role="img" aria-label="매월 반복" className="text-blue-400">&#x1F504;</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => void handleDelete(tx.id)}
                                aria-label={`${tx.description} ${formatKRW(tx.amount)} 지출 삭제`}
                                className="text-gray-500 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
