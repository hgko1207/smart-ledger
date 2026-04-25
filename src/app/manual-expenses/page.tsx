"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/db/schema";
import { MANUAL_CATEGORY_COLORS as CATEGORY_COLORS } from "@/lib/theme/colors";
import { formatKRW, formatDate, getMonthOptions } from "@/lib/format";

type ManualCategory =
  | "헌금/기부"
  | "용돈/지원"
  | "계모임/회비"
  | "주택대출"
  | "주택대출-원금"
  | "주택대출-이자"
  | "차량대출"
  | "차량대출-원금"
  | "차량대출-이자"
  | "가족대출"
  | "기타대출"
  | "기타대출-원금"
  | "기타대출-이자"
  | "현금지출"
  | "계좌이체"
  | "기타";

const CATEGORIES: ManualCategory[] = [
  "헌금/기부",
  "용돈/지원",
  "계모임/회비",
  "주택대출",
  "주택대출-원금",
  "주택대출-이자",
  "차량대출",
  "차량대출-원금",
  "차량대출-이자",
  "가족대출",
  "기타대출",
  "기타대출-원금",
  "기타대출-이자",
  "현금지출",
  "계좌이체",
  "기타",
];

/** 원금/이자 분리가 가능한 대출 카테고리 (split 토글 표시) */
const SPLITTABLE_LOAN_CATEGORIES: ReadonlySet<ManualCategory> = new Set([
  "주택대출",
  "차량대출",
  "기타대출",
]);

/** 기존 legacy 대출 행 — "분리" 버튼 노출 대상 */
const LOAN_LEGACY_FOR_SPLIT: ReadonlySet<string> = new Set([
  "주택대출",
  "차량대출",
  "기타대출",
]);

/** 대출 카테고리 → 원금 하위 카테고리 매핑 */
const LOAN_PRINCIPAL_MAP: Record<string, ManualCategory> = {
  "주택대출": "주택대출-원금",
  "차량대출": "차량대출-원금",
  "기타대출": "기타대출-원금",
};

/** 대출 카테고리 → 이자 하위 카테고리 매핑 */
const LOAN_INTEREST_MAP: Record<string, ManualCategory> = {
  "주택대출": "주택대출-이자",
  "차량대출": "차량대출-이자",
  "기타대출": "기타대출-이자",
};

/** 반복 항목 수정/삭제/분리 범위 */
type Scope = "this" | "future" | "all";

/** 신규 반복 생성에 필요한 payload */
interface CreateRecurringPayload {
  date: string;
  description: string;
  amount: number;
  category: ManualCategory;
  isRecurring: number;
  split?: { interestAmount: number };
}

/** scope 모달이 트리거하는 액션 종류 */
type PendingAction =
  | { kind: "edit"; id: string }
  | { kind: "delete"; id: string; description: string }
  | { kind: "split"; id: string; interestAmount: number; description: string }
  | { kind: "create"; payload: CreateRecurringPayload };

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
  const [formSplitLoan, setFormSplitLoan] = useState(false);
  const [formInterestAmount, setFormInterestAmount] = useState("");
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
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");

  // Scope 모달 (반복 항목 bulk 적용)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [scopeChoice, setScopeChoice] = useState<Scope>("all");
  const [scopeSubmitting, setScopeSubmitting] = useState(false);
  // 신규 생성 시 미래 월 제외 (기본 ON — 실제 입력하지 않은 월에 가짜 지출이 생기지 않도록)
  const [excludeFuture, setExcludeFuture] = useState(true);

  // 기존 legacy 대출 행 분리 인라인 상태
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splitInterestAmount, setSplitInterestAmount] = useState("");

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/manual-expenses?year=${selectedYear}&month=${selectedMonth}`,
        { cache: "no-store" }
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

    const totalAmount = parseInt(formAmount.replace(/,/g, ""), 10);
    const wantsSplit = formSplitLoan && SPLITTABLE_LOAN_CATEGORIES.has(formCategory);
    const interestAmount = wantsSplit
      ? parseInt(formInterestAmount.replace(/,/g, ""), 10) || 0
      : 0;

    if (wantsSplit) {
      if (interestAmount <= 0) {
        alert("이자 금액을 입력해주세요.");
        return;
      }
      if (interestAmount >= totalAmount) {
        alert("이자 금액은 총 납입액보다 작아야 합니다.");
        return;
      }
    }

    // 반복 체크 → scope 모달 (일괄 생성: 이 달 / 이 달~12월 / 올해 전체)
    if (formRecurring) {
      setScopeChoice("all");
      setPendingAction({
        kind: "create",
        payload: {
          date: formDate,
          description: formDesc,
          amount: totalAmount,
          category: formCategory,
          isRecurring: 1,
          split: wantsSplit ? { interestAmount } : undefined,
        },
      });
      return;
    }

    setSubmitting(true);
    try {
      if (wantsSplit) {
        const principalAmount = totalAmount - interestAmount;
        const principalCategory = LOAN_PRINCIPAL_MAP[formCategory];
        const interestCategory = LOAN_INTEREST_MAP[formCategory];

        // 원금 건
        const res1 = await fetch("/api/manual-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formDate,
            description: `${formDesc} (원금)`,
            amount: principalAmount,
            category: principalCategory,
            isRecurring: formRecurring ? 1 : 0,
          }),
        });
        if (!res1.ok) {
          const errData = (await res1.json()) as { error: string };
          throw new Error(errData.error);
        }

        // 이자 건
        const res2 = await fetch("/api/manual-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formDate,
            description: `${formDesc} (이자)`,
            amount: interestAmount,
            category: interestCategory,
            isRecurring: formRecurring ? 1 : 0,
          }),
        });
        if (!res2.ok) {
          const errData = (await res2.json()) as { error: string };
          throw new Error(errData.error);
        }
      } else {
        const res = await fetch("/api/manual-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formDate,
            description: formDesc,
            amount: totalAmount,
            category: formCategory,
            isRecurring: formRecurring ? 1 : 0,
          }),
        });
        if (!res.ok) {
          const errData = (await res.json()) as { error: string };
          throw new Error(errData.error);
        }
      }

      setFormDesc("");
      setFormAmount("");
      setFormRecurring(false);
      setFormSplitLoan(false);
      setFormInterestAmount("");
      setShowForm(false);

      const d = new Date(formDate);
      const submittedYear = d.getFullYear();
      const submittedMonth = d.getMonth() + 1;
      if (submittedYear !== selectedYear || submittedMonth !== selectedMonth) {
        setSelectedYear(submittedYear);
        setSelectedMonth(submittedMonth);
      } else {
        await fetchData();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 추가에 실패했습니다.";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startMemoEdit(tx: Transaction) {
    setEditingMemoId(tx.id);
    setMemoText(tx.memo ?? "");
  }

  async function saveMemo(id: string) {
    const newMemo = memoText.trim() || null;
    try {
      const res = await fetch(`/api/transactions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, memo: newMemo }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      setExpenses((prev) =>
        prev.map((tx) => (tx.id === id ? { ...tx, memo: newMemo } : tx))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "메모 저장에 실패했습니다.";
      alert(message);
    } finally {
      setEditingMemoId(null);
    }
  }

  async function performDelete(id: string, scope: Scope): Promise<number> {
    const res = await fetch(`/api/manual-expenses?id=${id}&scope=${scope}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errData = (await res.json()) as { error: string };
      throw new Error(errData.error);
    }
    const result = (await res.json()) as { affected?: number };
    await fetchData();
    return result.affected ?? 0;
  }

  async function handleDelete(id: string) {
    const target = expenses.find((tx) => tx.id === id);
    if (target && target.isRecurring === 1) {
      // 반복 항목: scope 모달 오픈 (confirm 대신)
      setScopeChoice("all");
      setPendingAction({ kind: "delete", id, description: target.description });
      return;
    }

    if (!confirm("이 지출을 삭제하시겠습니까?")) return;
    try {
      await performDelete(id, "this");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 삭제에 실패했습니다.";
      alert(message);
    }
  }

  async function performSplit(
    id: string,
    interestAmount: number,
    scope: Scope
  ): Promise<number> {
    const res = await fetch("/api/manual-expenses?action=split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, interestAmount, scope }),
    });
    if (!res.ok) {
      const errData = (await res.json()) as { error: string };
      throw new Error(errData.error);
    }
    const result = (await res.json()) as { processed?: number };
    setSplittingId(null);
    setSplitInterestAmount("");
    await fetchData();
    return result.processed ?? 0;
  }

  function handleSplitRequest(tx: Transaction) {
    const interestAmount = parseInt(splitInterestAmount.replace(/,/g, ""), 10);
    if (!interestAmount || interestAmount <= 0) {
      alert("이자 금액을 입력해주세요.");
      return;
    }
    if (interestAmount >= tx.amount) {
      alert("이자 금액은 총 납입액보다 작아야 합니다.");
      return;
    }

    // 반복 항목이면 scope 선택 모달, 아니면 바로 this
    if (tx.isRecurring === 1) {
      setScopeChoice("all");
      setPendingAction({
        kind: "split",
        id: tx.id,
        interestAmount,
        description: tx.description,
      });
      return;
    }

    void (async () => {
      try {
        await performSplit(tx.id, interestAmount, "this");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "분리에 실패했습니다.";
        alert(message);
      }
    })();
  }

  /** scope + excludeFuture를 명시적 months[] 배열로 변환 */
  function computeRecurringMonths(
    payload: CreateRecurringPayload,
    scope: Scope,
    exclude: boolean
  ): number[] {
    const d = new Date(payload.date);
    const targetYear = d.getFullYear();
    const baseMonth = d.getMonth() + 1;

    let months: number[];
    if (scope === "this") months = [baseMonth];
    else if (scope === "future") {
      months = [];
      for (let m = baseMonth; m <= 12; m++) months.push(m);
    } else {
      months = [];
      for (let m = 1; m <= 12; m++) months.push(m);
    }

    if (exclude) {
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth() + 1;
      if (targetYear > todayYear) return [];
      if (targetYear === todayYear) {
        months = months.filter((m) => m <= todayMonth);
      }
      // targetYear < todayYear: 모두 과거이므로 그대로
    }

    return months;
  }

  async function performCreateRecurring(
    payload: CreateRecurringPayload,
    scope: Scope
  ): Promise<{ created: number; skipped: number; monthsCount: number }> {
    const months = computeRecurringMonths(payload, scope, excludeFuture);
    if (months.length === 0) {
      return { created: 0, skipped: 0, monthsCount: 0 };
    }
    const res = await fetch("/api/manual-expenses?action=create-recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, months }),
    });
    if (!res.ok) {
      const errData = (await res.json()) as { error: string };
      throw new Error(errData.error);
    }
    const result = (await res.json()) as { created?: number; skipped?: number };
    // 폼 리셋 + 월 자동 이동 + 재조회
    setFormDesc("");
    setFormAmount("");
    setFormRecurring(false);
    setFormSplitLoan(false);
    setFormInterestAmount("");
    setShowForm(false);

    const d = new Date(payload.date);
    const targetYear = d.getFullYear();
    const targetMonth = d.getMonth() + 1;
    if (targetYear !== selectedYear || targetMonth !== selectedMonth) {
      setSelectedYear(targetYear);
      setSelectedMonth(targetMonth);
    } else {
      await fetchData();
    }
    return {
      created: result.created ?? 0,
      skipped: result.skipped ?? 0,
      monthsCount: months.length,
    };
  }

  async function handleScopeConfirm() {
    if (!pendingAction) return;
    setScopeSubmitting(true);
    try {
      let affected = 0;
      let verb = "";
      let skipped = 0;
      if (pendingAction.kind === "edit") {
        affected = await performEditSave(scopeChoice);
        verb = "수정";
      } else if (pendingAction.kind === "delete") {
        affected = await performDelete(pendingAction.id, scopeChoice);
        verb = "삭제";
      } else if (pendingAction.kind === "split") {
        affected = await performSplit(
          pendingAction.id,
          pendingAction.interestAmount,
          scopeChoice
        );
        verb = "분리";
      } else if (pendingAction.kind === "create") {
        const result = await performCreateRecurring(
          pendingAction.payload,
          scopeChoice
        );
        affected = result.created;
        skipped = result.skipped;
        verb = "생성";
        if (result.monthsCount === 0) {
          setPendingAction(null);
          setTimeout(() => {
            alert("선택 기간에 생성할 월이 없습니다. (미래 월 제외 옵션을 확인해보세요.)");
          }, 80);
          return;
        }
      }
      setPendingAction(null);
      // 결과 피드백
      setTimeout(() => {
        if (pendingAction.kind === "create") {
          const skipMsg = skipped > 0 ? ` (기존 ${skipped}건 중복 스킵)` : "";
          if (affected === 0) {
            alert(`이미 존재하는 항목이라 새로 생성된 건이 없습니다${skipMsg}.`);
          } else {
            alert(`${affected}건이 생성되었습니다${skipMsg}.`);
          }
          return;
        }
        if (affected === 0) {
          alert(`${verb}할 항목을 찾지 못했습니다. 매칭되는 행이 없습니다.`);
        } else if (scopeChoice !== "this" && affected === 1) {
          alert(`1건만 ${verb}되었습니다. 다른 달에 동일 설명·금액·카테고리의 항목이 없거나, 값이 달라 매칭되지 않았을 수 있습니다.`);
        } else if (scopeChoice !== "this") {
          alert(`${affected}건이 ${verb}되었습니다.`);
        }
      }, 80);
    } catch (err) {
      const message = err instanceof Error ? err.message : "처리에 실패했습니다.";
      alert(message);
    } finally {
      setScopeSubmitting(false);
    }
  }

  function handleScopeCancel() {
    setPendingAction(null);
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

  async function performEditSave(scope: Scope): Promise<number> {
    if (!editingId) return 0;
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
        scope,
      }),
    });
    if (!res.ok) {
      const errData = (await res.json()) as { error: string };
      throw new Error(errData.error);
    }
    const result = (await res.json()) as { affected?: number };
    setEditingId(null);

    const d = new Date(editData.date);
    const editedYear = d.getFullYear();
    const editedMonth = d.getMonth() + 1;
    if (editedYear !== selectedYear || editedMonth !== selectedMonth) {
      setSelectedYear(editedYear);
      setSelectedMonth(editedMonth);
    } else {
      await fetchData();
    }
    return result.affected ?? 0;
  }

  async function handleEditSave() {
    if (!editingId) return;
    const current = expenses.find((tx) => tx.id === editingId);
    // 반복 항목이면 scope 모달 오픈
    if (current && current.isRecurring === 1 && editData.isRecurring) {
      setScopeChoice("all");
      setPendingAction({ kind: "edit", id: editingId });
      return;
    }

    setEditSubmitting(true);
    try {
      await performEditSave("this");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "지출 수정에 실패했습니다.";
      alert(message);
    } finally {
      setEditSubmitting(false);
    }
  }

  const [copyingRecurring, setCopyingRecurring] = useState(false);

  async function handleCopyRecurring() {
    if (!confirm(`반복 항목을 ${selectedYear}년 ${selectedMonth}월에 일괄 추가합니다. 이미 있는 항목은 건너뜁니다.`)) return;
    setCopyingRecurring(true);
    try {
      const res = await fetch(
        `/api/manual-expenses?action=copy-recurring&year=${selectedYear}&month=${selectedMonth}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const result = (await res.json()) as { copied: number };
      await fetchData();
      // alert은 렌더링 후 표시 (UI 업데이트 차단 방지)
      setTimeout(() => {
        if (result.copied > 0) {
          alert(`${result.copied}건의 반복 항목이 추가되었습니다.`);
        } else {
          alert("이미 모든 반복 항목이 등록되어 있습니다.");
        }
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : "반복 항목 복사에 실패했습니다.";
      alert(message);
    } finally {
      setCopyingRecurring(false);
    }
  }

  // 요약 계산
  const totalAmount = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const recurringCount = expenses.filter((tx) => tx.isRecurring === 1).length;
  const loanPrincipal = expenses
    .filter((tx) => tx.category.endsWith("-원금"))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const loanInterest = expenses
    .filter((tx) => tx.category.endsWith("-이자"))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const loanLegacy = expenses
    .filter(
      (tx) =>
        tx.category === "주택대출" ||
        tx.category === "차량대출" ||
        tx.category === "가족대출" ||
        tx.category === "기타대출"
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const loanRepayment = loanPrincipal + loanInterest + loanLegacy;

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
                {(loanPrincipal > 0 || loanInterest > 0) ? (
                  <div className="mt-2 space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-400">원금 (자산 이동)</span>
                      <span className="font-mono text-blue-400">{formatKRW(loanPrincipal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-400">이자 (실지출)</span>
                      <span className="font-mono text-red-400">{formatKRW(loanInterest)}</span>
                    </div>
                    {loanLegacy > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">미분류 대출</span>
                        <span className="font-mono text-gray-500">{formatKRW(loanLegacy)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">주택/차량/기타 대출 합계</p>
                )}
              </div>
            </div>

            {/* 지출 목록 섹션 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">지출 목록</h2>
                  <p className="text-xs text-gray-500 mt-0.5">클릭하여 인라인 편집</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleCopyRecurring()}
                    disabled={copyingRecurring}
                    aria-label="반복 항목 이번 달에 일괄 추가"
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                  >
                    {copyingRecurring ? "복사 중..." : "🔄 반복 항목 추가"}
                  </button>
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

                  {/* 원금/이자 분리 (대출 카테고리에만 표시) */}
                  {SPLITTABLE_LOAN_CATEGORIES.has(formCategory) && (
                    <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formSplitLoan}
                          onChange={(e) => setFormSplitLoan(e.target.checked)}
                          aria-label="원금/이자 분리 입력"
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            원금 / 이자 분리 입력
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            원금 상환은 자산 이동(저축 성격), 이자만 실지출입니다. 분석 정확도가 올라갑니다.
                          </p>
                        </div>
                      </label>
                      {formSplitLoan && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">이자 금액 <span className="text-red-400">*</span></label>
                            <input
                              type="text"
                              value={formInterestAmount}
                              onChange={(e) => setFormInterestAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                              placeholder="400,000"
                              aria-label="이자 금액 입력"
                              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-end">
                            <p className="text-xs text-gray-500 pb-2">
                              {(() => {
                                const total = parseInt(formAmount.replace(/,/g, ""), 10) || 0;
                                const interest = parseInt(formInterestAmount.replace(/,/g, ""), 10) || 0;
                                const principal = total - interest;
                                if (total <= 0 || interest <= 0) {
                                  return "예: 110만원 중 이자 40만원 입력 → 원금 70만원 자동 계산";
                                }
                                if (interest >= total) {
                                  return "⚠ 이자가 총액보다 크거나 같을 수 없습니다.";
                                }
                                return `→ 원금 ${principal.toLocaleString("ko-KR")}원 + 이자 ${interest.toLocaleString("ko-KR")}원 = 2건으로 저장됩니다.`;
                              })()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                          <Fragment key={tx.id}>
                            <tr
                              className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                              onClick={() => startEdit(tx)}
                            >
                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(tx.date)}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                <div>{tx.description}</div>
                                {editingMemoId === tx.id ? (
                                  <input
                                    type="text"
                                    value={memoText}
                                    onChange={(e) => setMemoText(e.target.value)}
                                    onBlur={() => void saveMemo(tx.id)}
                                    onKeyDown={(e) => { if (e.key === "Enter") void saveMemo(tx.id); if (e.key === "Escape") setEditingMemoId(null); }}
                                    onClick={(e) => e.stopPropagation()}
                                    maxLength={100}
                                    autoFocus
                                    placeholder="메모 입력..."
                                    aria-label="메모 편집"
                                    className="mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                ) : tx.memo ? (
                                  <button onClick={(e) => { e.stopPropagation(); startMemoEdit(tx); }} className="text-xs text-gray-400 mt-0.5 truncate max-w-full text-left" aria-label={`메모 수정: ${tx.memo}`}>
                                    📝 {tx.memo}
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); startMemoEdit(tx); }} className="text-xs text-gray-500/50 mt-0.5 opacity-0 group-hover:opacity-100" aria-label="메모 추가">
                                    + 메모
                                  </button>
                                )}
                              </td>
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
                                <div className="flex items-center justify-center gap-2">
                                  {LOAN_LEGACY_FOR_SPLIT.has(tx.category) && (
                                    <button
                                      onClick={() => {
                                        setSplittingId(tx.id);
                                        setSplitInterestAmount("");
                                      }}
                                      aria-label={`${tx.description} 원금/이자 분리`}
                                      className="text-blue-500 hover:text-blue-400 text-xs font-medium transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      ✂ 분리
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void handleDelete(tx.id)}
                                    aria-label={`${tx.description} ${formatKRW(tx.amount)} 지출 삭제`}
                                    className="text-gray-500 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {splittingId === tx.id && (
                              <tr className="bg-blue-500/5 border-l-4 border-blue-500">
                                <td colSpan={6} className="px-4 py-4">
                                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="flex-1">
                                      <label className="block text-xs text-gray-500 mb-1">
                                        <span className="text-gray-900 dark:text-white font-medium">{tx.description}</span> ({formatKRW(tx.amount)}) → 원금/이자 분리
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">이자 금액:</span>
                                        <input
                                          type="text"
                                          value={splitInterestAmount}
                                          onChange={(e) => setSplitInterestAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                                          placeholder="400,000"
                                          autoFocus
                                          aria-label="이자 금액 입력"
                                          className="w-40 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-500">
                                          {(() => {
                                            const interest = parseInt(splitInterestAmount.replace(/,/g, ""), 10) || 0;
                                            if (interest <= 0) return "";
                                            if (interest >= tx.amount) return "⚠ 총액보다 작아야 합니다";
                                            return `→ 원금 ${(tx.amount - interest).toLocaleString("ko-KR")}원`;
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSplitRequest(tx)}
                                        aria-label="원금/이자 분리 적용"
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium text-white transition-colors"
                                      >
                                        분리 적용
                                      </button>
                                      <button
                                        onClick={() => { setSplittingId(null); setSplitInterestAmount(""); }}
                                        aria-label="분리 취소"
                                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
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

      {/* Scope 모달 — 반복 항목 bulk 적용 확인 */}
      {pendingAction && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scope-modal-title"
          onClick={handleScopeCancel}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="scope-modal-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {pendingAction.kind === "edit"
                ? "반복 지출 수정"
                : pendingAction.kind === "delete"
                  ? "반복 지출 삭제"
                  : pendingAction.kind === "split"
                    ? "반복 지출 원금/이자 분리"
                    : "반복 지출 일괄 생성"}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {pendingAction.kind === "create"
                ? "매월 반복 체크된 항목입니다. 어느 기간에 생성할까요? (이미 존재하는 월은 자동 스킵)"
                : "매월 반복 설정된 항목입니다. 어떤 범위에 적용할까요?"}
            </p>
            <div className="space-y-2 mb-4">
              {(["all", "future", "this"] as const).map((s) => {
                const createYear = pendingAction.kind === "create"
                  ? new Date(pendingAction.payload.date).getFullYear()
                  : selectedYear;
                const createMonth = pendingAction.kind === "create"
                  ? new Date(pendingAction.payload.date).getMonth() + 1
                  : selectedMonth;
                // create 모드의 종료 월: excludeFuture 켜져있고 올해이면 오늘 월, 아니면 12월
                const today = new Date();
                const todayYear = today.getFullYear();
                const todayMonth = today.getMonth() + 1;
                const endMonth =
                  pendingAction.kind === "create" && excludeFuture && createYear === todayYear
                    ? Math.min(12, todayMonth)
                    : 12;
                const willBeEmpty =
                  pendingAction.kind === "create" &&
                  excludeFuture &&
                  ((createYear > todayYear) ||
                    (createYear === todayYear && s === "future" && createMonth > todayMonth));
                const labels: Record<Scope, { title: string; desc: string }> =
                  pendingAction.kind === "create"
                    ? {
                        all: {
                          title: "올해 전체",
                          desc: `${createYear}년 1월 ~ ${endMonth}월에 자동 생성${
                            excludeFuture && endMonth < 12 ? " (미래 제외)" : ""
                          }`,
                        },
                        future: {
                          title: "이 달부터",
                          desc:
                            willBeEmpty
                              ? "⚠ 시작월이 오늘 이후라 생성될 월이 없습니다"
                              : `${createYear}년 ${createMonth}월 ~ ${endMonth}월에 자동 생성${
                                  excludeFuture && endMonth < 12 ? " (미래 제외)" : ""
                                }`,
                        },
                        this: {
                          title: "이 달만",
                          desc: `${createYear}년 ${createMonth}월에만 1건 저장`,
                        },
                      }
                    : {
                        all: {
                          title: "모든 달",
                          desc: "같은 설명·금액의 반복 항목 전부 (1~12월)",
                        },
                        future: {
                          title: "이 달 및 이후",
                          desc: `${selectedYear}년 ${selectedMonth}월부터 이후 월까지`,
                        },
                        this: {
                          title: "이 달만",
                          desc: "현재 선택한 한 건만",
                        },
                      };
                const info = labels[s];
                const active = scopeChoice === s;
                return (
                  <label
                    key={s}
                    className={`block cursor-pointer rounded-xl border p-3 transition-colors ${
                      active
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="scope"
                        value={s}
                        checked={active}
                        onChange={() => setScopeChoice(s)}
                        className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{info.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* create 모드일 때만 미래 월 제외 토글 노출 */}
            {pendingAction.kind === "create" && (
              <label className="flex items-start gap-2 cursor-pointer mb-5 px-1">
                <input
                  type="checkbox"
                  checked={excludeFuture}
                  onChange={(e) => setExcludeFuture(e.target.checked)}
                  aria-label="미래 월 제외"
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    미래 월은 제외 (오늘 이후 안 만듦)
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    실제로 결제하지 않은 미래 월에 가짜 지출이 생기는 걸 방지합니다. 예산
                    관리용으로 12월까지 미리 등록하려면 체크 해제.
                  </p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleScopeCancel}
                disabled={scopeSubmitting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={() => void handleScopeConfirm()}
                disabled={scopeSubmitting}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  pendingAction.kind === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {scopeSubmitting
                  ? "처리 중..."
                  : pendingAction.kind === "delete"
                    ? "삭제"
                    : pendingAction.kind === "create"
                      ? "생성"
                      : "적용"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
