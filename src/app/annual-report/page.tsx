"use client";

import { useState, useEffect, useCallback } from "react";
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
  Legend,
} from "recharts";
import {
  CHART_COLORS as COLORS,
  TOOLTIP_STYLE,
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
} from "@/lib/theme/colors";
import { formatKRW } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

interface MonthlyDataRow {
  month: number;
  expense: number;
  income: number;
}

interface CategoryTotalRow {
  category: string;
  total: number;
}

interface AnnualReportData {
  year: number;
  monthlyData: MonthlyDataRow[];
  categoryTotals: CategoryTotalRow[];
  totalExpense: number;
  totalExpenseRaw: number;
  excludedExpense: number;
  monthsWithCardData: number[];
  excludedMonths: number[];
  totalIncome: number;
  totalSavings: number;
  avgMonthlyExpense: number;
  topMonth: { month: number; expense: number };
  bottomMonth: { month: number; expense: number };
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

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 2024; y--) {
    years.push(y);
  }
  return years;
}

export default function AnnualReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/annual-report?year=${y}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("데이터 조회 실패");
      const json: AnnualReportData = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(year);
  }, [year, fetchData]);

  if (loading) return <PageSkeleton />;
  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-gray-500 dark:text-gray-400">
          데이터를 불러올 수 없습니다.
        </p>
      </div>
    );
  }

  const netSavings = data.totalIncome - data.totalExpense;
  const barChartData = data.monthlyData.map((d) => ({
    name: MONTH_LABELS[d.month - 1],
    지출: d.expense,
    수입: d.income,
  }));

  const yearOptions = getYearOptions();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          연간 리포트
        </h1>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          aria-label="연도 선택"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {/* 카드 미업로드 월 안내 — 합계가 부풀려지는 걸 방지 */}
      {data.excludedMonths.length > 0 && data.excludedExpense > 0 && (
        <div className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-blue-400 text-lg leading-none mt-0.5">ℹ</span>
          <div className="flex-1 text-sm">
            <p className="text-gray-900 dark:text-white font-medium">
              카드 명세서가 있는 {data.monthsWithCardData.length}개월(
              {data.monthsWithCardData.map((m) => `${m}월`).join(", ")}) 기준 합계입니다.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              카드 미업로드 월(
              {data.excludedMonths.map((m) => `${m}월`).join(", ")})의 기타 지출{" "}
              <span className="text-blue-400 font-medium">
                {formatKRW(data.excludedExpense)}
              </span>
              은 합계에서 제외됩니다 (참고용 전체 합계:{" "}
              {formatKRW(data.totalExpenseRaw)}).
            </p>
          </div>
        </div>
      )}

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5"
          aria-label="총수입"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            총수입
          </p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatKRW(data.totalIncome)}
          </p>
        </div>
        <div
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5"
          aria-label="총지출"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            총지출
          </p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatKRW(data.totalExpense)}
          </p>
        </div>
        <div
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5"
          aria-label="순저축"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            순저축
          </p>
          <p
            className={`text-lg font-bold ${
              netSavings >= 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {netSavings >= 0 ? "+" : ""}
            {formatKRW(netSavings)}
          </p>
        </div>
        <div
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5"
          aria-label="월평균 지출"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            월평균 지출
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatKRW(data.avgMonthlyExpense)}
          </p>
        </div>
      </div>

      {/* 가장 많이/적게 쓴 달 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            가장 많이 쓴 달
          </p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {data.topMonth.month}월
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatKRW(data.topMonth.expense)}
          </p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            가장 적게 쓴 달
          </p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {data.bottomMonth.month}월
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatKRW(data.bottomMonth.expense)}
          </p>
        </div>
      </div>

      {/* 월별 지출/수입 추이 BarChart */}
      <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          월별 지출/수입 추이
        </h2>
        <div
          className="w-full h-80"
          role="img"
          aria-label="월별 지출 및 수입 추이 막대 차트"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)
                }
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={tooltipFormatter}
              />
              <Legend />
              <Bar dataKey="수입" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="지출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 카테고리별 연간 합계 PieChart (도넛) */}
      {data.categoryTotals.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            카테고리별 연간 지출
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div
              className="w-64 h-64 flex-shrink-0"
              role="img"
              aria-label="카테고리별 연간 지출 비율 도넛 차트"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryTotals}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="total"
                    nameKey="category"
                    paddingAngle={2}
                  >
                    {data.categoryTotals.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={COLORS[idx % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={tooltipFormatter}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* 범례 */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {data.categoryTotals.map((cat, idx) => (
                <div key={cat.category} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {cat.category}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white ml-auto">
                    {formatKRW(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
