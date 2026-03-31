import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

interface FixedCostItem {
  description: string;
  avgAmount: number;
  months: number;
  category: string;
}

interface FixedCostsResponse {
  fixedCosts: FixedCostItem[];
  totalMonthly: number;
}

/**
 * GET: 고정비 자동 감지
 *
 * 최근 3개월 데이터를 조회하여
 * 같은 가맹점에 3개월 연속 비슷한 금액(+-20%) 결제 시 고정비로 판단
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    // 최근 3개월 계산
    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(year, month - 1 - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    // 3개월치 거래 조회 (양수 금액 = 지출만)
    const conditions = months.map(
      (m) => sql`(${transactions.year} = ${m.year} AND ${transactions.month} = ${m.month})`
    );
    const whereClause = sql`(${sql.join(conditions, sql` OR `)})`;

    const rows = await db
      .select({
        description: transactions.description,
        amount: transactions.amount,
        category: transactions.category,
        year: transactions.year,
        month: transactions.month,
      })
      .from(transactions)
      .where(and(gt(transactions.amount, 0), whereClause));

    // 가맹점별로 월별 금액 그룹화
    const merchantMonthly = new Map<
      string,
      { category: string; monthAmounts: Map<string, number> }
    >();

    for (const row of rows) {
      const key = row.description;
      const monthKey = `${row.year}-${row.month}`;

      if (!merchantMonthly.has(key)) {
        merchantMonthly.set(key, {
          category: row.category,
          monthAmounts: new Map(),
        });
      }

      const entry = merchantMonthly.get(key)!;
      const existing = entry.monthAmounts.get(monthKey) ?? 0;
      entry.monthAmounts.set(monthKey, existing + row.amount);
    }

    const fixedCosts: FixedCostItem[] = [];

    for (const [description, data] of merchantMonthly) {
      // 3개월 모두 있는지 확인
      if (data.monthAmounts.size < 3) continue;

      const amounts = [...data.monthAmounts.values()];
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;

      // 모든 월의 금액이 평균의 +-20% 이내인지 확인
      const isConsistent = amounts.every(
        (a) => Math.abs(a - avg) / avg <= 0.2
      );

      if (isConsistent) {
        fixedCosts.push({
          description,
          avgAmount: Math.round(avg),
          months: amounts.length,
          category: data.category,
        });
      }
    }

    // 금액 높은 순 정렬
    fixedCosts.sort((a, b) => b.avgAmount - a.avgAmount);

    const totalMonthly = fixedCosts.reduce((s, c) => s + c.avgAmount, 0);

    const response: FixedCostsResponse = { fixedCosts, totalMonthly };
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "고정비 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
