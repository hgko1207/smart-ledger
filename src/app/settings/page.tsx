"use client";

import { useState, useEffect, useCallback } from "react";
import type { CategoryRule } from "@/db/schema";

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

  // 새 규칙 폼
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("0");
  const [submitting, setSubmitting] = useState(false);

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-gray-400">가계부 설정 관리</p>
        </div>

        {/* 지출 카테고리 관리 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">지출 카테고리 규칙</h2>
          <p className="text-sm text-gray-400 mb-6">
            가맹점명에 패턴(키워드)이 포함되면 해당 카테고리로 자동 분류됩니다. 우선순위가 높을수록 먼저 매칭됩니다.
          </p>

          {/* 새 규칙 추가 폼 */}
          <form onSubmit={(e) => void handleAddRule(e)} className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">새 규칙 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">패턴 (키워드)</label>
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="스타벅스"
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">카테고리</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="카페"
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">우선순위</label>
                <input
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          </form>

          {/* 규칙 목록 */}
          {loading ? (
            <p className="text-gray-400 text-center py-8">로딩 중...</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchRules()}
                className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                다시 시도
              </button>
            </div>
          ) : rules.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록된 카테고리 규칙이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">패턴</th>
                    <th className="text-left text-sm text-gray-400 font-medium px-4 py-2">카테고리</th>
                    <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">우선순위</th>
                    <th className="text-center text-sm text-gray-400 font-medium px-4 py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-2 text-sm">
                        <code className="bg-gray-800 px-2 py-0.5 rounded text-yellow-300">{rule.pattern}</code>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
                          {rule.category}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-400">
                        {rule.priority}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => void handleDeleteRule(rule.id)}
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

        {/* 수입 카테고리 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">수입 카테고리</h2>
          <p className="text-sm text-gray-400 mb-4">
            현재 사용 가능한 수입 카테고리 목록입니다. (고정 목록)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(INCOME_SOURCE_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="bg-gray-800/50 rounded-lg px-4 py-3 text-sm"
              >
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-600 ml-2 text-xs">({key})</span>
              </div>
            ))}
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">비밀번호 변경</h2>
          <div className="bg-gray-800/50 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">향후 구현 예정입니다.</p>
            <p className="text-gray-600 text-xs mt-2">
              현재 비밀번호는 환경변수(LEDGER_PASSWORD_HASH)로 관리됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
