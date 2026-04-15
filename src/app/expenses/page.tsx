"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/db/schema";
import { CATEGORY_BG_COLORS as CATEGORY_COLORS } from "@/lib/theme/colors";
import { formatKRW, formatDate, getMonthOptions } from "@/lib/format";

const CATEGORIES = [
  "식비", "외식", "배달", "식료품/마트", "교통", "고속도로", "주차", "자동차",
  "쇼핑", "패션/뷰티", "의료", "보험", "주거/관리비", "통신", "교육", "구독",
  "여행", "문화/여가", "육아/완구", "생활", "기타",
];

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
  const [sortKey, setSortKey] = useState<"amount" | "date" | "category" | "description">("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: "amount" | "date" | "category" | "description") {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  }

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

  // 검색 필터링 + 정렬
  const filteredTransactions = transactions
    .filter((tx) => {
      if (!searchText) return true;
      return tx.description.toLowerCase().includes(searchText.toLowerCase());
    })
    .sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      switch (sortKey) {
        case "amount": return (a.amount - b.amount) * dir;
        case "date": return a.date.localeCompare(b.date) * dir;
        case "category": return a.category.localeCompare(b.category) * dir;
        case "description": return a.description.localeCompare(b.description) * dir;
        default: return 0;
      }
    });

  const totalAmount = filteredTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">지출 상세</h1>
            <p className="text-gray-400 mt-1">전체 거래 내역 조회 및 관리</p>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            대시보드
          </a>
        </div>

        {/* 필터 영역 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {/* 월 선택 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">기간</label>
              <select
                aria-label="기간 선택"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={handleMonthChange}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">카테고리</label>
              <select
                aria-label="카테고리 필터"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 본인/가족 필터 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">구분</label>
              <select
                aria-label="본인/가족 구분 필터"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                <option value="본인">본인</option>
                <option value="가족">가족</option>
              </select>
            </div>

            {/* 검색 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">가맹점 검색</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  aria-label="가맹점 검색"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="가맹점명 입력..."
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          {/* 요약 바 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            <span className="text-sm text-gray-400">
              총 <span className="text-gray-900 dark:text-white font-medium">{filteredTransactions.length}</span>건
            </span>
            <span className="text-sm">
              합계: <span className="text-gray-900 dark:text-white font-semibold font-mono">{formatKRW(totalAmount)}</span>
            </span>
          </div>
        </div>

        {/* 테이블 / 로딩 / 에러 / 빈 상태 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-400">거래 내역을 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center">
            <svg className="w-12 h-12 text-red-400/60 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => void fetchData()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center">
            <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 mb-2 text-lg">이번 달 거래 내역이 없습니다</p>
            <p className="text-gray-500 text-sm mb-6">명세서를 업로드하면 자동으로 거래 내역이 등록됩니다.</p>
            <a
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              명세서 업로드
            </a>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                      <th scope="col" aria-sort={sortKey === "date" ? (sortDir === "desc" ? "descending" : "ascending") : "none"} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5 select-none">
                        <button type="button" onClick={() => handleSort("date")} aria-label={`날짜 기준 정렬 (현재 ${sortKey === "date" ? (sortDir === "desc" ? "내림차순" : "오름차순") : "정렬 안 됨"})`} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200">
                          날짜 {sortKey === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      </th>
                      <th scope="col" aria-sort={sortKey === "description" ? (sortDir === "desc" ? "descending" : "ascending") : "none"} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5 select-none">
                        <button type="button" onClick={() => handleSort("description")} aria-label={`가맹점 기준 정렬 (현재 ${sortKey === "description" ? (sortDir === "desc" ? "내림차순" : "오름차순") : "정렬 안 됨"})`} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200">
                          가맹점 {sortKey === "description" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      </th>
                      <th scope="col" aria-sort={sortKey === "amount" ? (sortDir === "desc" ? "descending" : "ascending") : "none"} className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5 select-none">
                        <button type="button" onClick={() => handleSort("amount")} aria-label={`금액 기준 정렬 (현재 ${sortKey === "amount" ? (sortDir === "desc" ? "내림차순" : "오름차순") : "정렬 안 됨"})`} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200 ml-auto">
                          금액 {sortKey === "amount" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      </th>
                      <th scope="col" aria-sort={sortKey === "category" ? (sortDir === "desc" ? "descending" : "ascending") : "none"} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5 select-none">
                        <button type="button" onClick={() => handleSort("category")} aria-label={`카테고리 기준 정렬 (현재 ${sortKey === "category" ? (sortDir === "desc" ? "내림차순" : "오름차순") : "정렬 안 됨"})`} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200">
                          카테고리 {sortKey === "category" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      </th>
                      <th scope="col" className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5">카드</th>
                      <th scope="col" className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5">구분</th>
                      <th scope="col" className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3.5">
                        <span className="sr-only">작업</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                    {filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="group hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm text-gray-400 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-200 max-w-[240px] truncate">
                          {tx.description}
                        </td>
                        <td className={`px-5 py-3.5 text-sm text-right font-mono whitespace-nowrap ${
                          tx.amount < 0 ? "text-green-400" : tx.amount >= 100000 ? "text-gray-900 dark:text-white font-semibold" : "text-gray-700 dark:text-gray-200"
                        }`}>
                          {tx.amount < 0 ? "-" : ""}{formatKRW(Math.abs(tx.amount))}
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          {editingId === tx.id ? (
                            <select
                              aria-label="카테고리 변경"
                              value={tx.category}
                              onChange={(e) => void handleCategoryChange(tx.id, e.target.value)}
                              onBlur={() => setEditingId(null)}
                              autoFocus
                              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingId(tx.id)}
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-sm transition-colors"
                              title="클릭하여 카테고리 변경"
                            >
                              <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[tx.category] ?? "bg-gray-400"}`} />
                              <span className="text-gray-600 dark:text-gray-300">{tx.category}</span>
                              <svg className="w-3 h-3 text-gray-500 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                          {tx.cardName}
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                            tx.memberType === "본인"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}>
                            {tx.memberType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => void handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                            aria-label={`${tx.description} 거래 삭제`}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-sm disabled:opacity-50 transition-all"
                          >
                            {deletingId === tx.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 모바일 카드 뷰 */}
            <div className="md:hidden space-y-3">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{tx.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(tx.date)} · {tx.cardName}</p>
                    </div>
                    <p className={`text-sm font-mono font-medium ml-3 whitespace-nowrap ${
                      tx.amount < 0 ? "text-green-400" : "text-gray-900 dark:text-white"
                    }`}>
                      {tx.amount < 0 ? "-" : ""}{formatKRW(Math.abs(tx.amount))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingId === tx.id ? (
                        <select
                          aria-label="카테고리 변경"
                          value={tx.category}
                          onChange={(e) => void handleCategoryChange(tx.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                          className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingId(tx.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-300 transition-colors"
                          title="클릭하여 카테고리 변경"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[tx.category] ?? "bg-gray-400"}`} />
                          {tx.category}
                        </button>
                      )}
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        tx.memberType === "본인"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {tx.memberType}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      aria-label={`${tx.description} 거래 삭제`}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    >
                      {deletingId === tx.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
