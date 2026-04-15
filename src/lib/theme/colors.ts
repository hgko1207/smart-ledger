/**
 * 색상 토큰 단일 소스.
 * - CHART_COLORS: Recharts 등 hex 값이 필요한 경우 (fill/stroke)
 * - CATEGORY_BG_COLORS: 지출 카테고리 Tailwind 배경 클래스
 * - INCOME_SOURCE_COLORS: 수입 소스 Tailwind pill 클래스
 * - MANUAL_CATEGORY_COLORS: 수동 지출 카테고리 Tailwind pill 클래스
 * - TOOLTIP_STYLE: Recharts 공용 툴팁 (하드코딩 hex — 다크모드 전용)
 */

export const CHART_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
] as const;

export const CATEGORY_BG_COLORS: Record<string, string> = {
  "식비": "bg-orange-400",
  "외식": "bg-amber-400",
  "배달": "bg-red-400",
  "식료품/마트": "bg-orange-300",
  "교통": "bg-blue-400",
  "고속도로": "bg-blue-300",
  "주차": "bg-sky-400",
  "자동차": "bg-yellow-400",
  "쇼핑": "bg-pink-400",
  "패션/뷰티": "bg-rose-400",
  "의료": "bg-red-500",
  "보험": "bg-red-300",
  "주거/관리비": "bg-violet-400",
  "통신": "bg-indigo-400",
  "교육": "bg-cyan-400",
  "구독": "bg-purple-400",
  "여행": "bg-emerald-400",
  "문화/여가": "bg-lime-400",
  "육아/완구": "bg-green-400",
  "생활": "bg-teal-400",
  "기타": "bg-gray-400",
};

export const INCOME_SOURCE_COLORS: Record<string, string> = {
  salary: "bg-blue-500/20 text-blue-300",
  bonus: "bg-green-500/20 text-green-300",
  freelance: "bg-purple-500/20 text-purple-300",
  tax_refund: "bg-orange-500/20 text-orange-300",
  investment: "bg-cyan-500/20 text-cyan-300",
  allowance: "bg-pink-500/20 text-pink-300",
  other: "bg-gray-500/20 text-gray-300",
};

export const MANUAL_CATEGORY_COLORS: Record<string, string> = {
  "헌금/기부": "bg-purple-500/20 text-purple-300",
  "용돈/지원": "bg-pink-500/20 text-pink-300",
  "계모임/회비": "bg-indigo-500/20 text-indigo-300",
  "주택대출": "bg-red-500/20 text-red-300",
  "차량대출": "bg-orange-500/20 text-orange-300",
  "가족대출": "bg-rose-500/20 text-rose-300",
  "기타대출": "bg-amber-500/20 text-amber-300",
  "현금지출": "bg-green-500/20 text-green-300",
  "계좌이체": "bg-cyan-500/20 text-cyan-300",
  "기타": "bg-gray-500/20 text-gray-300",
};

export const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #1f2937",
  borderRadius: "8px",
  color: "#fff",
} as const;

// Recharts 축/격자/기본 bar 색상 (다크모드 전제)
export const CHART_AXIS_COLOR = "#6b7280";
export const CHART_GRID_COLOR = "#1f2937";
export const CHART_PRIMARY_BAR = "#3b82f6";

// 인사이트 카드 색상 — 배지 표준(text-*-300 bg-*-500/20)과 동일 톤
export const INSIGHT_COLORS = {
  increase: "text-red-300 bg-red-500/20 border-red-500/20",
  decrease: "text-green-300 bg-green-500/20 border-green-500/20",
  saving_tip: "text-yellow-300 bg-yellow-500/20 border-yellow-500/20",
  info: "text-blue-300 bg-blue-500/20 border-blue-500/20",
} as const;
