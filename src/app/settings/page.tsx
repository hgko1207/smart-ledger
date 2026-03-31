"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CategoryRule, Budget } from "@/db/schema";

const BUDGET_CATEGORIES = [
  "식비", "외식", "배달", "식료품/마트", "교통", "쇼핑", "패션/뷰티",
  "의료", "주거/관리비", "통신", "교육", "구독", "여행", "문화/여가",
  "육아/완구", "자동차", "생활", "기타",
];

const INCOME_SOURCE_LABELS: Record<string, string> = {
  salary: "월급",
  bonus: "보너스",
  freelance: "프리랜서/알바",
  tax_refund: "연말정산/환급",
  investment: "투자수익",
  allowance: "용돈/지원금",
  other: "기타",
};

export default function SettingsPage() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 앱 이름(부제) 설정
  const [subtitleInput, setSubtitleInput] = useState("가족 가계부");
  const [subtitleSaved, setSubtitleSaved] = useState(false);
  const subtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("smart-ledger-subtitle");
      if (stored) setSubtitleInput(stored);
    } catch {
      // ignore
    }
  }, []);

  function handleSubtitleSave() {
    const value = subtitleInput.trim() || "가족 가계부";
    localStorage.setItem("smart-ledger-subtitle", value);
    setSubtitleInput(value);
    window.dispatchEvent(new CustomEvent("smart-ledger-subtitle-changed"));
    setSubtitleSaved(true);
    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    subtitleTimeoutRef.current = setTimeout(() => setSubtitleSaved(false), 2000);
  }

  // 예산 설정
  const [budgetList, setBudgetList] = useState<Budget[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetCategory, setBudgetCategory] = useState(BUDGET_CATEGORIES[0]);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);

  const fetchBudgets = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const res = await fetch("/api/budgets");
      if (!res.ok) throw new Error("예산 목록 로딩 실패");
      const data = (await res.json()) as { budgets: Budget[] };
      setBudgetList(data.budgets);
    } catch {
      // silent
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBudgets();
  }, [fetchBudgets]);

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(budgetAmount, 10);
    if (!budgetCategory || !amount || amount <= 0) return;

    setBudgetSubmitting(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: budgetCategory, monthlyLimit: amount }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setBudgetAmount("");
      void fetchBudgets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "예산 저장에 실패했습니다.";
      alert(message);
    } finally {
      setBudgetSubmitting(false);
    }
  }

  async function handleDeleteBudget(id: string) {
    if (!confirm("이 예산 설정을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      void fetchBudgets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "예산 삭제에 실패했습니다.";
      alert(message);
    }
  }

  // 새 규칙 폼
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings/categories");
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const data = (await res.json()) as { rules: CategoryRule[] };
      setRules(data.rules);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "카테고리 규칙 로딩에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newPattern || !newCategory) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: newPattern,
          category: newCategory,
          priority: parseInt(newPriority, 10) || 0,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setNewPattern("");
      setNewCategory("");
      setNewPriority("0");
      void fetchRules();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "규칙 추가에 실패했습니다.";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("이 규칙을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/settings/categories?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      void fetchRules();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "규칙 삭제에 실패했습니다.";
      alert(message);
    }
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">설정</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">카테고리 규칙 및 가계부 환경을 관리합니다</p>
        </div>

        {/* 앱 이름 설정 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">앱 이름 설정</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">사이드바에 표시되는 부제를 변경합니다</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label htmlFor="subtitle-input" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                부제 (최대 20자)
              </label>
              <input
                id="subtitle-input"
                type="text"
                value={subtitleInput}
                onChange={(e) => setSubtitleInput(e.target.value.slice(0, 20))}
                maxLength={20}
                placeholder="가족 가계부"
                aria-label="앱 부제 입력"
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <button
              onClick={handleSubtitleSave}
              aria-label="부제 저장"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors text-white"
            >
              {subtitleSaved ? "저장됨" : "저장"}
            </button>
          </div>
        </div>

        {/* 지출 카테고리 관리 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">지출 카테고리 규칙</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                가맹점명에 패턴이 포함되면 해당 카테고리로 자동 분류됩니다
              </p>
            </div>
          </div>

          {/* 새 규칙 추가 폼 */}
          <form onSubmit={(e) => void handleAddRule(e)} className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">새 규칙 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="new-pattern" className="block text-xs font-medium text-gray-400 mb-1.5">
                  패턴 (키워드) <span className="text-red-400">*</span>
                </label>
                <input
                  id="new-pattern"
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="스타벅스"
                  required
                  aria-label="카테고리 규칙 패턴 입력"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label htmlFor="new-category" className="block text-xs font-medium text-gray-400 mb-1.5">
                  카테고리 <span className="text-red-400">*</span>
                </label>
                <input
                  id="new-category"
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="카페"
                  required
                  aria-label="카테고리명 입력"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label htmlFor="new-priority" className="block text-xs font-medium text-gray-400 mb-1.5">
                  우선순위
                </label>
                <input
                  id="new-priority"
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  placeholder="0"
                  aria-label="우선순위 입력"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  aria-label="규칙 추가"
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {submitting ? "추가 중..." : "규칙 추가"}
                </button>
              </div>
            </div>
          </form>

          {/* 규칙 목록 — 접기/펼기 */}
          <button
            onClick={() => setShowRules(!showRules)}
            aria-expanded={showRules}
            aria-label={showRules ? "규칙 목록 접기" : "규칙 목록 펼치기"}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl mb-4 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
              등록된 규칙 {rules.length}개
            </span>
            <span className="text-gray-400 text-xs">
              {showRules ? "접기 ▲" : "펼치기 ▼"}
            </span>
          </button>
          {showRules && (loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24" aria-label="로딩">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-400 text-sm">규칙을 불러오는 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <svg className="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => void fetchRules()}
                aria-label="다시 시도"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                다시 시도
              </button>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-gray-400 text-sm">등록된 카테고리 규칙이 없습니다</p>
              <p className="text-gray-500 text-xs mt-1">위 폼에서 새 규칙을 추가해 보세요</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/50">
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3 rounded-l-lg">패턴</th>
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">카테고리</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-4 py-3">우선순위</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-4 py-3 rounded-r-lg">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <code className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-2 py-0.5 rounded text-yellow-600 dark:text-yellow-300 text-xs">{rule.pattern}</code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-xs border border-blue-500/20">
                          {rule.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-400">
                        {rule.priority}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => void handleDeleteRule(rule.id)}
                          aria-label={`${rule.pattern} 규칙 삭제`}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* 예산 설정 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">예산 설정</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">카테고리별 월간 예산 한도를 설정합니다</p>
            </div>
          </div>

          {/* 예산 추가 폼 */}
          <form onSubmit={(e) => void handleSaveBudget(e)} className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">예산 추가 / 수정</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="budget-category" className="block text-xs font-medium text-gray-400 mb-1.5">
                  카테고리 <span className="text-red-400">*</span>
                </label>
                <select
                  id="budget-category"
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  aria-label="예산 카테고리 선택"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {BUDGET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="budget-amount" className="block text-xs font-medium text-gray-400 mb-1.5">
                  월간 한도 (원) <span className="text-red-400">*</span>
                </label>
                <input
                  id="budget-amount"
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="500000"
                  required
                  min={1}
                  aria-label="월간 예산 한도 입력"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={budgetSubmitting}
                  aria-label="예산 저장"
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {budgetSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </form>

          {/* 예산 목록 */}
          {budgetLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-400 text-sm">예산을 불러오는 중...</p>
            </div>
          ) : budgetList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">설정된 예산이 없습니다</p>
              <p className="text-gray-500 text-xs mt-1">위 폼에서 카테고리별 예산을 설정해 보세요</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/50">
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3 rounded-l-lg">카테고리</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-3">월간 한도</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-4 py-3 rounded-r-lg">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetList.map((b) => (
                    <tr key={b.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs border border-emerald-500/20">
                          {b.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                        {b.monthlyLimit.toLocaleString("ko-KR")}원
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => void handleDeleteBudget(b.id)}
                          aria-label={`${b.category} 예산 삭제`}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors px-2 py-1 rounded hover:bg-red-500/10"
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

        {/* 수입 카테고리 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">수입 카테고리</h2>
              <p className="text-xs text-gray-400 mt-0.5">현재 사용 가능한 수입 카테고리 목록입니다 (고정 목록)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(INCOME_SOURCE_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-gray-500 ml-2 text-xs">({key})</span>
              </div>
            ))}
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">비밀번호 변경</h2>
              <p className="text-xs text-gray-400 mt-0.5">접근 비밀번호 관리</p>
            </div>
          </div>
          <div className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">향후 구현 예정입니다</p>
            <p className="text-gray-500 text-xs mt-1.5">
              현재 비밀번호는 환경변수(LEDGER_PASSWORD_HASH)로 관리됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
