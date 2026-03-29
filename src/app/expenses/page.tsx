"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/db/schema";

const CATEGORIES = [
  "식비", "교통", "쇼핑", "구독", "의료", "교육", "여행", "자동차", "생활", "기타",
];

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

export default function ExpensesPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      });
      if (categoryFilter) params.set("category", categoryFilter);
      if (memberFilter) params.set("memberType", memberFilter);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const result = (await res.json()) as { transactions: Transaction[] };
      setTransactions(result.transactions);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "데이터 로딩에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, categoryFilter, memberFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-");
    setSelectedYear(parseInt(y, 10));
    setSelectedMonth(parseInt(m, 10));
  }

  async function handleCategoryChange(id: string, newCategory: string) {
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, category: newCategory }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === id ? { ...tx, category: newCategory, customCategory: newCategory } : tx
        )
      );
      setEditingId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "카테고리 수정에 실패했습니다.";
      alert(message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "거래 삭제에 실패했습니다.";
      alert(message);
    } finally {
      setDeletingId(null);
    }
  }

  // 검색 필터링 + 금액 내림차순 정렬
  const filteredTransactions = transactions
    .filter((tx) => {
      if (!searchText) return true;
      return tx.description.toLowerCase().includes(searchText.toLowerCase());
    })
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = filteredTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">지출 상세</h1>
            <p className="text-gray-400">전체 거래 내역 조회 및 관리</p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            대시보드
          </a>
        </div>

        {/* 필터 영역 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {/* 월 선택 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">기간</label>
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={handleMonthChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {monthOptions.map((opt) => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 카테고리 필터 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">카테고리</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 본인/가족 필터 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">구분</label>
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체</option>
                <option value="본인">본인</option>
                <option value="가족">가족</option>
              </select>
            </div>

            {/* 검색 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">가맹점 검색</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="가맹점명 입력..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
            </div>
          </div>

          {/* 요약 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              총 {filteredTransactions.length}건
            </span>
            <span className="font-medium">
              합계: {formatKRW(totalAmount)}
            </span>
          </div>
        </div>

        {/* 테이블 */}
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
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <p className="text-gray-500">조건에 맞는 거래 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-3">날짜</th>
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-3">가맹점</th>
                    <th className="text-right text-sm text-gray-400 font-medium px-4 py-3">금액</th>
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-3">카테고리</th>
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-3">카드</th>
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-3">구분</th>
                    <th className="text-center text-sm text-gray-400 font-medium px-4 py-3">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {tx.description}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-mono ${
                        tx.amount < 0 ? "text-green-400" : "text-white"
                      }`}>
                        {tx.amount < 0 ? "-" : ""}{formatKRW(Math.abs(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === tx.id ? (
                          <select
                            value={tx.category}
                            onChange={(e) => void handleCategoryChange(tx.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            autoFocus
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingId(tx.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
                            title="클릭하여 카테고리 변경"
                          >
                            <span>{tx.category}</span>
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {tx.cardName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          tx.memberType === "본인"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {tx.memberType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => void handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50 transition-colors"
                          title="거래 삭제"
                        >
                          {deletingId === tx.id ? "..." : "삭제"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
