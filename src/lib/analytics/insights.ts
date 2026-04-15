import { formatKRW } from "@/lib/format";

interface MonthlyCategoryData {
  year: number;
  month: number;
  category: string;
  total: number;
}

interface TopMerchant {
  description: string;
  total: number;
  count: number;
}

interface MemberComparison {
  memberType: string;
  total: number;
}

export interface Insight {
  type: "increase" | "decrease" | "saving_tip" | "info";
  message: string;
}

/**
 * 전월 대비 카테고리별 증감 인사이트 생성
 */
export function generateCategoryInsights(
  currentMonth: MonthlyCategoryData[],
  previousMonth: MonthlyCategoryData[]
): Insight[] {
  const insights: Insight[] = [];

  const prevMap = new Map<string, number>();
  for (const item of previousMonth) {
    prevMap.set(item.category, item.total);
  }

  for (const item of currentMonth) {
    const prevTotal = prevMap.get(item.category);
    if (prevTotal && prevTotal > 0 && item.total > 0) {
      const changeRate = ((item.total - prevTotal) / prevTotal) * 100;

      if (changeRate > 10) {
        insights.push({
          type: "increase",
          message: `이번 달 ${item.category}가 지난달 대비 ${changeRate.toFixed(0)}% 증가했습니다. (${formatKRW(prevTotal)} -> ${formatKRW(item.total)})`,
        });
      } else if (changeRate < -10) {
        insights.push({
          type: "decrease",
          message: `이번 달 ${item.category}가 지난달 대비 ${Math.abs(changeRate).toFixed(0)}% 감소했습니다. (${formatKRW(prevTotal)} -> ${formatKRW(item.total)})`,
        });
      }
    }
  }

  return insights;
}

/**
 * 절약 시뮬레이션 인사이트 생성
 */
export function generateSavingTips(
  currentMonth: MonthlyCategoryData[]
): Insight[] {
  const insights: Insight[] = [];

  // 상위 카테고리에서 10% 절약 시뮬레이션
  const sorted = [...currentMonth].sort((a, b) => b.total - a.total);
  const top3 = sorted.slice(0, 3);

  for (const item of top3) {
    if (item.total > 50000) {
      const savingAmount = Math.round(item.total * 0.1);
      insights.push({
        type: "saving_tip",
        message: `${item.category}를 10% 줄이면 월 ${formatKRW(savingAmount)} 절약할 수 있습니다.`,
      });
    }
  }

  return insights;
}

/**
 * 본인 vs 가족 비교 인사이트
 */
export function generateMemberInsights(
  members: MemberComparison[]
): Insight[] {
  const insights: Insight[] = [];

  if (members.length >= 2) {
    const total = members.reduce((sum, m) => sum + m.total, 0);
    if (total > 0) {
      const parts = members
        .map((m) => `${m.memberType} ${formatKRW(m.total)} (${((m.total / total) * 100).toFixed(0)}%)`)
        .join(", ");
      insights.push({
        type: "info",
        message: `이번 달 지출: ${parts}`,
      });
    }
  }

  return insights;
}

export interface AnalyticsResponse {
  year: number;
  month: number;
  monthlyTotals: { year: number; month: number; total: number }[];
  monthlyCategoryData: MonthlyCategoryData[];
  topMerchants: TopMerchant[];
  memberComparison: MemberComparison[];
  insights: Insight[];
}
