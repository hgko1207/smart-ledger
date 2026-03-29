"use client";

import { useState, useEffect, useCallback } from "react";
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

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/analytics?year=${selectedYear}&month=${selectedMonth}`
      );
      if (!res.ok) {
        const errData = (await res.json()) as { error: string };
        throw new Error(errData.error);
      }
      const result = (await res.json()) as AnalyticsResponse;
      setData(result);
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
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // 월별 지출 비교 데이터
  const monthlyBarData = data.monthlyTotals.map((mt) => ({
    name: `${mt.month}월`,
    total: mt.total,
  }));

  // 카테고리별 트렌드 데이터 (LineChart)
  const allCategories = [
    ...new Set(data.monthlyCategoryData.map((d) => d.category)),
  ];
  const monthLabels = data.monthlyTotals.map(
    (mt) => `${mt.month}월`
  );
  const trendData = monthLabels.map((label, idx) => {
    const mt = data.monthlyTotals[idx];
    const entry: Record<string, string | number> = { name: label };
    for (const cat of allCategories) {
      const found = data.monthlyCategoryData.find(
        (d) => d.year === mt.year && d.month === mt.month && d.category === cat
      );
      entry[cat] = found?.total ?? 0;
    }
    return entry;
  });

  // 본인 vs 가족 비교 데이터
  const totalMember = data.memberComparison.reduce((sum, m) => sum + m.total, 0);

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">지출 분석</h1>
            <p className="text-gray-400">지출 패턴 분석 및 인사이트</p>
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

        {/* 인사이트 카드 */}
        {data.insights.length > 0 && (
          <div className="space-y-3 mb-8">
            <h2 className="text-lg font-semibold">인사이트</h2>
            {data.insights.map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-xl border ${insightColor(insight.type)}`}
              >
                <span className="text-lg shrink-0 mt-0.5">{insightIcon(insight.type)}</span>
                <span className="text-sm">{insight.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* 월별 지출 비교 + TOP 5 지출처 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 월별 지출 비교 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">월별 지출 비교</h2>
            {monthlyBarData.some((d) => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis
                    tickFormatter={formatAxisKRW}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="total" name="지출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                데이터가 없습니다.
              </div>
            )}
          </div>

          {/* TOP 5 지출처 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">TOP 5 지출처</h2>
            {data.topMerchants.length > 0 ? (
              <div className="space-y-4">
                {data.topMerchants.map((merchant, idx) => {
                  const maxTotal = data.topMerchants[0]?.total ?? 1;
                  const widthPct = (merchant.total / maxTotal) * 100;
                  return (
                    <div key={merchant.description}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-500 w-6">
                            {idx + 1}
                          </span>
                          <span className="text-sm">{merchant.description}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{merchant.count}건</span>
                          <span className="text-sm font-mono">{formatKRW(merchant.total)}</span>
                        </div>
                      </div>
                      <div className="ml-8 w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">카테고리별 트렌드 (최근 3개월)</h2>
          {trendData.length > 0 && allCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  tickFormatter={formatAxisKRW}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
                {allCategories.map((cat, idx) => (
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
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 본인 vs 가족 비교 */}
        {data.memberComparison.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">본인 vs 가족 지출 비교</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.memberComparison.map((m) => {
                const pct = totalMember > 0 ? (m.total / totalMember) * 100 : 0;
                return (
                  <div key={m.memberType} className="bg-gray-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-lg font-semibold ${
                        m.memberType === "본인" ? "text-blue-400" : "text-purple-400"
                      }`}>
                        {m.memberType}
                      </span>
                      <span className="text-xl font-bold">{formatKRW(m.total)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
                      <div
                        className={`h-4 rounded-full transition-all ${
                          m.memberType === "본인" ? "bg-blue-500" : "bg-purple-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-400 text-right">{pct.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 데이터 없는 경우 */}
        {data.monthlyTotals.every((mt) => mt.total === 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <p className="text-xl text-gray-500 mb-4">분석할 데이터가 없습니다.</p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              명세서 업로드하기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
