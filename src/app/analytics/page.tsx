"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import type { AnalyticsResponse, Insight } from "@/lib/analytics/insights";
import type { InstallmentsResponse } from "@/app/api/installments/route";
import { CHART_COLORS as COLORS, TOOLTIP_STYLE } from "@/lib/theme/colors";
import { formatKRW, getMonthOptions } from "@/lib/format";

interface FixedCostItem {
  description: string;
  avgAmount: number;
  months: number;
  category: string;
}

interface FixedCostsData {
  fixedCosts: FixedCostItem[];
  totalMonthly: number;
}


function formatAxisKRW(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`;
  return String(v);
}

function tooltipFormatter(
  value: number | string | ReadonlyArray<number | string> | undefined
): string {
  if (value === undefined) return "";
  if (typeof value === "number") return formatKRW(value);
  if (typeof value === "string") return formatKRW(parseInt(value, 10));
  return String(value);
}

function insightIcon(type: Insight["type"]): string {
  switch (type) {
    case "increase":
      return "\u2191";
    case "decrease":
      return "\u2193";
    case "saving_tip":
      return "\u2728";
    case "info":
      return "\u2139";
  }
}

function insightColor(type: Insight["type"]): string {
  switch (type) {
    case "increase":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "decrease":
      return "text-green-400 bg-green-500/10 border-green-500/20";
    case "saving_tip":
      return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    case "info":
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }
}

export default function AnalyticsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [installData, setInstallData] = useState<InstallmentsResponse | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllInsights, setShowAllInsights] = useState(false);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [analyticsRes, installRes, fixedRes] = await Promise.all([
        fetch(`/api/analytics?year=${selectedYear}&month=${selectedMonth}`),
        fetch(`/api/installments?year=${selectedYear}&month=${selectedMonth}`),
        fetch(`/api/fixed-costs?year=${selectedYear}&month=${selectedMonth}`),
      ]);
      if (!analyticsRes.ok) {
        const errData = (await analyticsRes.json()) as { error: string };
        throw new Error(errData.error);
      }
      const result = (await analyticsRes.json()) as AnalyticsResponse;
      setData(result);

      if (installRes.ok) {
        const instResult = (await installRes.json()) as InstallmentsResponse;
        setInstallData(instResult);
      }

      if (fixedRes.ok) {
        const fixedResult = (await fixedRes.json()) as FixedCostsData;
        setFixedCosts(fixedResult);
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

  // All useMemo hooks must be declared before any conditional returns
  const monthlyBarData = useMemo(() => {
    if (!data) return [];
    return data.monthlyTotals.map((mt) => ({
      name: `${mt.month}월`,
      total: mt.total,
    }));
  }, [data]);

  const { trendData, trendCategories } = useMemo(() => {
    if (!data) return { trendData: [] as Record<string, string | number>[], trendCategories: [] as string[] };

    const allCategories = [
      ...new Set(data.monthlyCategoryData.map((d) => d.category)),
    ];
    const monthLabels = data.monthlyTotals.map((mt) => `${mt.month}월`);

    // Compute totals per category across all months for TOP 5 filtering
    const categoryTotals = new Map<string, number>();
    for (const cat of allCategories) {
      let sum = 0;
      for (const d of data.monthlyCategoryData) {
        if (d.category === cat) sum += d.total;
      }
      categoryTotals.set(cat, sum);
    }

    // Sort by total descending, take top 5
    const sorted = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    const top5Cats = sorted.slice(0, 5).map(([cat]) => cat);
    const otherCats = sorted.slice(5).map(([cat]) => cat);
    const hasOther = otherCats.length > 0;

    const displayCategories = hasOther ? [...top5Cats, "기타"] : top5Cats;

    const chartData = monthLabels.map((label, idx) => {
      const mt = data.monthlyTotals[idx];
      const entry: Record<string, string | number> = { name: label };
      for (const cat of top5Cats) {
        const found = data.monthlyCategoryData.find(
          (d) => d.year === mt.year && d.month === mt.month && d.category === cat
        );
        entry[cat] = found?.total ?? 0;
      }
      if (hasOther) {
        let otherSum = 0;
        for (const cat of otherCats) {
          const found = data.monthlyCategoryData.find(
            (d) => d.year === mt.year && d.month === mt.month && d.category === cat
          );
          otherSum += found?.total ?? 0;
        }
        entry["기타"] = otherSum;
      }
      return entry;
    });

    return { trendData: chartData, trendCategories: displayCategories };
  }, [data]);

  const totalMember = useMemo(() => {
    if (!data) return 0;
    return data.memberComparison.reduce((sum, m) => sum + m.total, 0);
  }, [data]);

  const isEmpty = useMemo(() => {
    if (!data) return true;
    return data.monthlyTotals.every((mt) => mt.total === 0);
  }, [data]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-");
    setSelectedYear(parseInt(y, 10));
    setSelectedMonth(parseInt(m, 10));
  }

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
            aria-label="다시 시도"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">지출 분석</h1>
            <p className="text-gray-400 mt-1">지출 패턴 분석 및 인사이트</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={handleMonthChange}
              aria-label="분석 월 선택"
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((opt) => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
            <a
              href="/"
              className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white transition-colors"
              aria-label="대시보드로 이동"
            >
              대시보드
            </a>
          </div>
        </div>

        {/* 빈 상태 */}
        {isEmpty && (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-lg text-gray-400 mb-2">분석할 데이터가 없습니다</p>
            <p className="text-sm text-gray-500 mb-6">명세서를 업로드하면 지출 분석을 확인할 수 있습니다.</p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-white transition-colors"
              aria-label="명세서 업로드 페이지로 이동"
            >
              명세서 업로드하기
            </a>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* 인사이트 섹션 */}
            {data.insights.length > 0 && (
              <section className="mb-8" aria-label="지출 인사이트">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">인사이트</h2>
                <div className="space-y-2">
                  {(showAllInsights ? data.insights : data.insights.slice(0, 3)).map((insight, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 px-6 py-3 rounded-xl border ${insightColor(insight.type)}`}
                    >
                      <span className="text-base shrink-0 mt-0.5">{insightIcon(insight.type)}</span>
                      <span className="text-sm leading-relaxed">{insight.message}</span>
                    </div>
                  ))}
                </div>
                {data.insights.length > 3 && (
                  <button
                    onClick={() => setShowAllInsights(!showAllInsights)}
                    aria-expanded={showAllInsights}
                    aria-label={showAllInsights ? "인사이트 접기" : "인사이트 더보기"}
                    className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1.5 mt-2"
                  >
                    {showAllInsights ? "접기" : `+${data.insights.length - 3}개 더보기`}
                  </button>
                )}
              </section>
            )}

            {/* 월별 지출 비교 + TOP 5 지출처 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 월별 지출 비교 */}
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">월별 지출 비교</h2>
                {monthlyBarData.some((d) => d.total > 0) ? (
                  <div
                    role="img"
                    aria-label={`월별 지출 비교 막대 차트. ${monthlyBarData.map((d) => `${d.name} ${d.total.toLocaleString("ko-KR")}원`).join(", ")}`}
                  >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={formatAxisKRW}
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar dataKey="total" name="지출" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    데이터가 없습니다.
                  </div>
                )}
              </div>

              {/* TOP 5 지출처 */}
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">TOP 5 지출처</h2>
                {data.topMerchants.length > 0 ? (
                  <div className="space-y-5">
                    {data.topMerchants.map((merchant, idx) => {
                      const maxTotal = data.topMerchants[0]?.total ?? 1;
                      const widthPct = (merchant.total / maxTotal) * 100;
                      return (
                        <div key={merchant.description} className="min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-sm font-bold text-gray-500 shrink-0 w-6 text-center">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white truncate">{merchant.description}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-gray-500">{merchant.count}건</span>
                              <span className="text-sm font-mono text-gray-900 dark:text-white">{formatKRW(merchant.total)}</span>
                            </div>
                          </div>
                          <div className="ml-8 bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-[width]"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: COLORS[idx % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 카테고리별 트렌드 */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">카테고리별 트렌드 (최근 3개월)</h2>
              {trendData.length > 0 && trendCategories.length > 0 ? (
                <div
                  role="img"
                  aria-label={`카테고리별 트렌드 꺾은선 차트. 표시 카테고리: ${trendCategories.join(", ")}`}
                >
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={formatAxisKRW}
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={tooltipFormatter}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Legend />
                    {trendCategories.map((cat, idx) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-500">
                  데이터가 없습니다.
                </div>
              )}
            </div>

            {/* 본인 vs 가족 비교 - 대시보드와 동일한 가로 바 스타일 */}
            {data.memberComparison.length > 1 && totalMember > 0 && (
              <section className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8" aria-label="본인 가족 지출 비교">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">본인 / 가족 지출</h2>
                  <span className="text-sm text-gray-400">총 {formatKRW(totalMember)}</span>
                </div>
                {/* 가로 바 */}
                <div className="w-full h-8 rounded-full overflow-hidden flex">
                  {data.memberComparison
                    .sort((a, b) => (a.memberType === "본인" ? -1 : 1))
                    .map((m) => {
                      const pct = totalMember > 0 ? (m.total / totalMember) * 100 : 0;
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
                  {data.memberComparison
                    .sort((a, b) => (a.memberType === "본인" ? -1 : 1))
                    .map((m) => {
                      const pct = totalMember > 0 ? ((m.total / totalMember) * 100).toFixed(0) : "0";
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

            {/* 고정비 현황 */}
            {fixedCosts && fixedCosts.fixedCosts.length > 0 && (
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">고정비 현황</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      감지된 고정비 <span className="text-purple-400 font-medium">{fixedCosts.fixedCosts.length}건</span>
                      {" / "}
                      월 합계 <span className="text-purple-400 font-medium">{formatKRW(fixedCosts.totalMonthly)}</span>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-200 dark:bg-gray-800/50">
                        <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5 rounded-l-lg">가맹점</th>
                        <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">카테고리</th>
                        <th className="text-right text-xs text-gray-400 font-medium px-4 py-2.5">월 평균</th>
                        <th className="text-right text-xs text-gray-400 font-medium px-4 py-2.5 rounded-r-lg">3개월 합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixedCosts.fixedCosts.map((fc) => (
                        <tr key={fc.description} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{fc.description}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-block px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-xs border border-purple-500/20">
                              {fc.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                            {formatKRW(fc.avgAmount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-500">
                            {formatKRW(fc.avgAmount * fc.months)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 할부 요약 */}
            {installData && installData.activeInstallments.length > 0 && (
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">할부 현황</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      진행 중 <span className="text-orange-400 font-medium">{installData.activeCount}건</span>
                      {" / "}
                      잔액 <span className="text-orange-400 font-medium">{formatKRW(installData.totalRemaining)}</span>
                      {" / "}
                      월 납부 <span className="text-orange-400 font-medium">{formatKRW(installData.monthlyPaymentTotal)}</span>
                    </p>
                  </div>
                  <a
                    href={`/installments?year=${selectedYear}&month=${selectedMonth}`}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white transition-colors shrink-0"
                    aria-label="할부 상세 페이지로 이동"
                  >
                    상세 보기
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
