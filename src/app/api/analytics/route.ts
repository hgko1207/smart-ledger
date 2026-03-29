import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  generateCategoryInsights,
  generateSavingTips,
  generateMemberInsights,
} from "@/lib/analytics/insights";
import type { AnalyticsResponse } from "@/lib/analytics/insights";

function getPreviousMonths(
  year: number,
  month: number,
  count: number
): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    months.push({ year: y, month: m });
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return months;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    const recentMonths = getPreviousMonths(year, month, 3);

    // 1. 월별 총 지출 (최근 3개월)
    const monthlyTotals: { year: number; month: number; total: number }[] = [];
    for (const rm of recentMonths) {
      const rows = await db
        .select({
          total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
        })
        .from(transactions)
        .where(
          and(eq(transactions.year, rm.year), eq(transactions.month, rm.month))
        );
      monthlyTotals.push({
        year: rm.year,
        month: rm.month,
        total: Number(rows[0]?.total ?? 0),
      });
    }

    // 2. 월별 카테고리별 합산 (최근 3개월)
    const monthlyCategoryData: {
      year: number;
      month: number;
      category: string;
      total: number;
    }[] = [];

    for (const rm of recentMonths) {
      const rows = await db
        .select({
          category: transactions.category,
          total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
        })
        .from(transactions)
        .where(
          and(eq(transactions.year, rm.year), eq(transactions.month, rm.month))
        )
        .groupBy(transactions.category);

      for (const r of rows) {
        monthlyCategoryData.push({
          year: rm.year,
          month: rm.month,
          category: r.category,
          total: Number(r.total),
        });
      }
    }

    // 3. TOP 5 지출처 (현재 월)
    const topMerchantRows = await db
      .select({
        description: transactions.description,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month)))
      .groupBy(transactions.description)
      .orderBy(desc(sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`))
      .limit(5);

    const topMerchants = topMerchantRows.map((r) => ({
      description: r.description,
      total: Number(r.total),
      count: Number(r.count),
    }));

    // 4. 본인 vs 가족 비교 (현재 월)
    const memberRows = await db
      .select({
        memberType: transactions.memberType,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month)))
      .groupBy(transactions.memberType);

    const memberComparison = memberRows.map((r) => ({
      memberType: r.memberType,
      total: Number(r.total),
    }));

    // 5. 인사이트 생성
    const currentCategoryData = monthlyCategoryData.filter(
      (d) => d.year === year && d.month === month
    );
    const prevMonth = recentMonths[1];
    const prevCategoryData = prevMonth
      ? monthlyCategoryData.filter(
          (d) => d.year === prevMonth.year && d.month === prevMonth.month
        )
      : [];

    const insights = [
      ...generateCategoryInsights(currentCategoryData, prevCategoryData),
      ...generateSavingTips(currentCategoryData),
      ...generateMemberInsights(memberComparison),
    ];

    const data: AnalyticsResponse = {
      year,
      month,
      monthlyTotals: monthlyTotals.reverse(), // 오래된 순서
      monthlyCategoryData,
      topMerchants,
      memberComparison,
      insights,
    };

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "분석 데이터 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
