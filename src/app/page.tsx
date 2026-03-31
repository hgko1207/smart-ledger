"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CategorySummary {
  category: string;
  total: number;
}

interface MemberSummary {
  memberType: string;
  total: number;
}

interface InstallmentSummary {
  activeCount: number;
  totalRemaining: number;
  monthlyPaymentTotal: number;
}

interface DashboardData {
  year: number;
  month: number;
  totalExpense: number;
  totalRefund: number;
  netExpense: number;
  categoryBreakdown: CategorySummary[];
  prevCategoryBreakdown: CategorySummary[];
  memberBreakdown: MemberSummary[];
  previousMonthExpense: number;
  changeRate: number | null;
  totalIncome: number;
  totalSavings: number;
  expenseToIncomeRatio: number | null;
  savingsRate: number | null;
}

/** 전월 대비 가장 크게 변한 카테고리 인사이트 생성 */
function generateInsight(
  current: CategorySummary[],
  prev: CategorySummary[],
  changeRate: number | null
): string | null {
  // 전체 지출 감소 시
  if (changeRate !== null && changeRate < -10) {
    return `지난달보다 ${Math.abs(changeRate).toFixed(0)}% 절약했어요! 잘하고 있어요 👏`;
  }

  if (prev.length === 0 || current.length === 0) return null;

  const prevMap = new Map(prev.map((c) => [c.category, c.total]));
  let maxIncrease = { category: "", rate: 0, amount: 0, prevAmount: 0 };

  for (const cat of current) {
    const prevTotal = prevMap.get(cat.category) ?? 0;
    if (prevTotal < 10000) continue; // 너무 작은 금액 변동은 무시
    const rate = ((cat.total - prevTotal) / prevTotal) * 100;
    if (rate > maxIncrease.rate) {
      maxIncrease = { category: cat.category, rate, amount: cat.total, prevAmount: prevTotal };
    }
  }

  if (maxIncrease.rate > 15) {
    const diff = maxIncrease.amount - maxIncrease.prevAmount;
    return `${maxIncrease.category}이(가) 전월보다 ${maxIncrease.rate.toFixed(0)}% 증가했어요 (+${diff.toLocaleString("ko-KR")}원)`;
  }

  // 큰 변동 없으면 가장 많이 쓴 카테고리
  const top = current.reduce((a, b) => (a.total > b.total ? a : b));
  return `이번 달은 ${top.category}에 가장 많이 지출했어요 (${top.total.toLocaleString("ko-KR")}원)`;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
];

const CATEGORY_SHORT_NAMES: Record<string, string> = {
  "식료품/마트": "마트",
  "주거/관리비": "주거비",
  "교통/자동차": "교통",
  "의료/건강": "의료",
  "교육/학원": "교육",
  "문화/여가": "문화",
  "의류/미용": "의류",
  "통신/구독": "통신",
  "보험/세금": "보험",
  "카페/간식": "카페",
  "외식/배달": "외식",
};

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function shortenCategory(name: string): string {
  return CATEGORY_SHORT_NAMES[name] ?? name;
}

// 월 선택 옵션 생성 (최근 12개월)
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

// Tooltip 포맷터
function tooltipFormatter(
  value: number | string | ReadonlyArray<number | string> | undefined
): string {
  if (value === undefined) return "";
  if (typeof value === "number") return formatKRW(value);
  if (typeof value === "string") return formatKRW(parseInt(value, 10));
  return String(value);
}

export default function DashboardPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [installments, setInstallments] = useState<InstallmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashRes, installRes] = await Promise.all([
        fetch(`/api/dashboard?year=${selectedYear}&month=${selectedMonth}`),
        fetch(`/api/installments?year=${selectedYear}&month=${selectedMonth}`),
      ]);
      if (!dashRes.ok) {
        const errData = (await dashRes.json()) as { error: string };
        throw new Error(errData.error);
      }
      const result = (await dashRes.json()) as DashboardData;
      setData(result);

      if (installRes.ok) {
        const installData = (await installRes.json()) as InstallmentSummary;
        setInstallments(installData);
      }
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

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.categoryBreakdown
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const barData = useMemo(() => {
    if (!data) return [];
    return data.categoryBreakdown
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const categoryListData = useMemo(() => {
    if (!data) return [];
    return data.categoryBreakdown
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const pieTotal = useMemo(() => {
    return pieData.reduce((sum, c) => sum + c.total, 0);
  }, [pieData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => void fetchData()}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasIncome = data.totalIncome > 0;
  const memberTotal = data.memberBreakdown.reduce((s, m) => s + m.total, 0);
  const visibleCategories = showAllCategories
    ? categoryListData
    : categoryListData.slice(0, 5);
  const maxCategoryTotal = categoryListData.length > 0 ? categoryListData[0].total : 0;

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 + 월 선택 */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold">대시보드</h1>
            <p className="text-gray-400 text-sm">가계부 한눈에 보기</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={handleMonthChange}
              aria-label="월 선택"
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((opt) => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
            <a
              href="/upload"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              업로드
            </a>
          </div>
        </div>

        {/* 빈 상태 */}
        {data.categoryBreakdown.length === 0 ? (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center">
            <p className="text-xl text-gray-400 mb-2">
              {data.year}년 {data.month}월 데이터가 없습니다.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              명세서를 업로드하세요
            </p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors"
            >
              명세서 업로드하기
            </a>
          </div>
        ) : (
          <>
            {/* 1. 히어로 섹션 - 총 지출 */}
            <section className="mb-10" aria-label="이번 달 총 지출">
              <p className="text-sm text-gray-400 mb-1">
                {data.year}년 {data.month}월 지출
              </p>
              <p className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                {formatKRW(data.netExpense)}
              </p>
              <div className="flex items-center gap-3 mt-2">
                {data.changeRate !== null ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      data.changeRate > 0
                        ? "bg-red-500/10 text-red-400"
                        : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {data.changeRate > 0 ? "\u2191" : "\u2193"}
                    {data.changeRate > 0 ? "+" : ""}
                    {data.changeRate.toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-800 text-gray-500">
                    전월 데이터 없음
                  </span>
                )}
                {data.previousMonthExpense > 0 && (
                  <span className="text-xs text-gray-500">
                    전월 {formatKRW(data.previousMonthExpense)}
                  </span>
                )}
              </div>
              {data.totalRefund < 0 && (
                <p className="text-xs text-green-400 mt-1">
                  환불 {formatKRW(Math.abs(data.totalRefund))}
                </p>
              )}
            </section>

            {/* 2. 요약 카드 그리드 */}
            <div
              className={`grid gap-4 mb-10 ${
                hasIncome ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-1 max-w-sm"
              }`}
            >
              {/* 수입 대비 지출 */}
              {hasIncome && (
                <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">수입 대비 지출</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.expenseToIncomeRatio !== null
                        ? `${data.expenseToIncomeRatio.toFixed(1)}%`
                        : "---"}
                    </p>
                    <p className="text-xs text-gray-500">수입 {formatKRW(data.totalIncome)}</p>
                  </div>
                </div>
              )}

              {/* 저축률 */}
              {hasIncome && (
                <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">저축률</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.savingsRate !== null
                        ? `${data.savingsRate.toFixed(1)}%`
                        : "---"}
                    </p>
                    <p className="text-xs text-gray-500">월 적금 {formatKRW(data.totalSavings)}</p>
                  </div>
                </div>
              )}

              {/* 진행 중 할부 */}
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400">진행 중 할부</p>
                  {installments && installments.activeCount > 0 ? (
                    <>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {installments.activeCount}건
                      </p>
                      <p className="text-xs text-gray-500">
                        잔액 {formatKRW(installments.totalRemaining)} / 월 {formatKRW(installments.monthlyPaymentTotal)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-gray-500">없음</p>
                      <p className="text-xs text-gray-500">진행 중인 할부 없음</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 3. 본인/가족 비교 - 토스 스타일 바 */}
            {data.memberBreakdown.length > 1 && memberTotal > 0 && (
              <section className="mb-10" aria-label="본인 가족 지출 비교">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">본인 / 가족 지출</h2>
                  <span className="text-sm text-gray-400">총 {formatKRW(memberTotal)}</span>
                </div>
                {/* 가로 바 */}
                <div className="w-full h-8 rounded-full overflow-hidden flex">
                  {data.memberBreakdown
                    .sort((a, b) => (a.memberType === "본인" ? -1 : 1))
                    .map((m) => {
                      const pct = memberTotal > 0 ? (m.total / memberTotal) * 100 : 0;
                      return (
                        <div
                          key={m.memberType}
                          className={m.memberType === "본인" ? "bg-blue-500" : "bg-purple-500"}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                </div>
                {/* 범례 */}
                <div className="flex items-center justify-between mt-3 text-sm">
                  {data.memberBreakdown
                    .sort((a, b) => (a.memberType === "본인" ? -1 : 1))
                    .map((m) => {
                      const pct = memberTotal > 0 ? ((m.total / memberTotal) * 100).toFixed(0) : "0";
                      const isOwn = m.memberType === "본인";
                      return (
                        <div
                          key={m.memberType}
                          className={`flex items-center gap-2 ${isOwn ? "" : "flex-row-reverse"}`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOwn ? "bg-blue-500" : "bg-purple-500"
                            }`}
                          />
                          <span className="text-gray-400">{m.memberType}</span>
                          <span className="text-gray-900 dark:text-white font-medium">{formatKRW(m.total)}</span>
                          <span className="text-gray-500">{pct}%</span>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* 4. 인사이트 한 줄 */}
            {(() => {
              const insight = generateInsight(
                data.categoryBreakdown,
                data.prevCategoryBreakdown,
                data.changeRate
              );
              if (!insight) return null;
              const isPositive = insight.includes("절약") || insight.includes("잘하고");
              return (
                <div
                  className={`rounded-2xl px-8 py-4 mb-8 flex items-center gap-4 ${
                    isPositive
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-yellow-500/10 border border-yellow-500/20"
                  }`}
                >
                  <span className="text-lg">{isPositive ? "🎉" : "💡"}</span>
                  <span className={`text-sm ${isPositive ? "text-green-400" : "text-yellow-300"}`}>
                    {insight}
                  </span>
                </div>
              );
            })()}

            {/* 5. 카테고리별 지출 — 도넛 차트 + 범례 (하나로 통합) */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-10">
              <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">카테고리별 지출</h2>
              {pieData.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  {/* 도넛 차트 */}
                  <div className="shrink-0 w-[240px] h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="total"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={110}
                          paddingAngle={1}
                          strokeWidth={0}
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={tooltipFormatter}
                          contentStyle={{
                            backgroundColor: "#111827",
                            border: "1px solid #1f2937",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 범례 — 카테고리 + 프로그레스 바 + 비율 + 금액 */}
                  <div className="flex-1 w-full space-y-3">
                    {pieData.map((cat, i) => {
                      const pct = pieTotal > 0 ? ((cat.total / pieTotal) * 100).toFixed(1) : "0";
                      const widthPct = pieTotal > 0 ? (cat.total / pieData[0].total) * 100 : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300 w-20 shrink-0">
                            {cat.category}
                          </span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2 min-w-0">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                            {pct}%
                          </span>
                          <span className="text-sm font-mono text-gray-900 dark:text-white w-28 text-right shrink-0">
                            {formatKRW(cat.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-gray-500">
                  이번 달 지출 데이터가 없습니다.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
