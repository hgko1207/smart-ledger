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
import type { PieLabelRenderProps } from "recharts";

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
  memberBreakdown: MemberSummary[];
  previousMonthExpense: number;
  changeRate: number | null;
  totalIncome: number;
  totalSavings: number;
  expenseToIncomeRatio: number | null;
  savingsRate: number | null;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
];

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
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

// Pie 차트 커스텀 라벨
function renderCustomLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? "");

  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#d1d5db"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
    >
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
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

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashRes, installRes] = await Promise.all([
        fetch(`/api/dashboard?year=${selectedYear}&month=${selectedMonth}`),
        fetch("/api/installments"),
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

  const pieData = data.categoryBreakdown
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const barData = data.categoryBreakdown
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">대시보드</h1>
            <p className="text-gray-400">가계부 한눈에 보기</p>
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
              href="/upload"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              업로드
            </a>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* 이번 달 총 지출 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">이번 달 총 지출</p>
            <p className="text-2xl font-bold">{formatKRW(data.netExpense)}</p>
            {data.totalRefund < 0 && (
              <p className="text-xs text-green-400 mt-1">
                환불 {formatKRW(Math.abs(data.totalRefund))}
              </p>
            )}
          </div>

          {/* 지난달 대비 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">지난달 대비</p>
            {data.changeRate !== null ? (
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    data.changeRate > 0 ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {data.changeRate > 0 ? "+" : ""}
                  {data.changeRate.toFixed(1)}%
                </span>
                <span className="text-lg">
                  {data.changeRate > 0 ? "\u2191" : "\u2193"}
                </span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-500">---</p>
            )}
            {data.previousMonthExpense > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                전월 {formatKRW(data.previousMonthExpense)}
              </p>
            )}
          </div>

          {/* 수입 대비 지출 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">수입 대비 지출</p>
            {data.expenseToIncomeRatio !== null ? (
              <div>
                <p className="text-2xl font-bold">
                  {data.expenseToIncomeRatio.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  수입 {formatKRW(data.totalIncome)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-gray-500">---</p>
                <p className="text-xs text-gray-500 mt-1">
                  수입 데이터 없음
                </p>
              </div>
            )}
          </div>

          {/* 저축률 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">저축률</p>
            {data.savingsRate !== null ? (
              <div>
                <p className="text-2xl font-bold text-blue-400">
                  {data.savingsRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  월 적금 {formatKRW(data.totalSavings)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-gray-500">---</p>
                <p className="text-xs text-gray-500 mt-1">
                  수입/적금 데이터 없음
                </p>
              </div>
            )}
          </div>

          {/* 진행 중 할부 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">진행 중 할부</p>
            {installments && installments.activeCount > 0 ? (
              <div>
                <p className="text-2xl font-bold text-orange-400">
                  {installments.activeCount}건
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  잔액 {formatKRW(installments.totalRemaining)}
                </p>
                <p className="text-xs text-gray-500">
                  월 {formatKRW(installments.monthlyPaymentTotal)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-gray-500">없음</p>
                <p className="text-xs text-gray-500 mt-1">
                  진행 중인 할부 없음
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 본인/가족 지출 비교 */}
        {data.memberBreakdown.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">본인 / 가족 지출</h2>
            <div className="flex gap-6">
              {data.memberBreakdown.map((m) => {
                const pct =
                  data.netExpense > 0
                    ? ((m.total / data.netExpense) * 100).toFixed(1)
                    : "0";
                return (
                  <div key={m.memberType} className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-300">{m.memberType}</span>
                      <span className="font-medium">{formatKRW(m.total)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          m.memberType === "본인"
                            ? "bg-blue-500"
                            : "bg-purple-500"
                        }`}
                        style={{
                          width: `${data.netExpense > 0 ? (m.total / data.netExpense) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 파이차트 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">카테고리별 비율</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderCustomLabel}
                    labelLine={false}
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
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                이번 달 지출 데이터가 없습니다.
              </div>
            )}
          </div>

          {/* 바차트 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">카테고리별 지출</h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      v >= 10000 ? `${(v / 10000).toFixed(0)}만` : `${v}`
                    }
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    stroke="#9ca3af"
                    fontSize={12}
                    width={55}
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#d1d5db" }}
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name="지출"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                이번 달 지출 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 카테고리별 상세 목록 */}
        {data.categoryBreakdown.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">카테고리별 상세</h2>
            <div className="space-y-3">
              {data.categoryBreakdown
                .filter((c) => c.total > 0)
                .sort((a, b) => b.total - a.total)
                .map((cat, i) => {
                  const maxTotal = data.categoryBreakdown.reduce(
                    (max, c) => Math.max(max, c.total),
                    0
                  );
                  const widthPct =
                    maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-4">
                      <span className="text-sm text-gray-300 w-20 shrink-0">
                        {cat.category}
                      </span>
                      <div className="flex-1 bg-gray-800 rounded-full h-4">
                        <div
                          className="h-4 rounded-full transition-all"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-sm font-mono text-gray-300 w-28 text-right shrink-0">
                        {formatKRW(cat.total)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 데이터 없는 경우 */}
        {data.categoryBreakdown.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <p className="text-xl text-gray-500 mb-4">
              {data.year}년 {data.month}월 데이터가 없습니다.
            </p>
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

