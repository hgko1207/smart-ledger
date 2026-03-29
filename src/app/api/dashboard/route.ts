import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, incomes, savings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

interface CategorySummary {
  category: string;
  total: number;
}

interface MemberSummary {
  memberType: string;
  total: number;
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
  changeRate: number | null; // percent, null if no previous data
  totalIncome: number;
  totalSavings: number;
  expenseToIncomeRatio: number | null;
  savingsRate: number | null;
}

function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    // 1. 이번 달 카테고리별 합산 (양수 금액만 = 지출)
    const categoryRows = await db
      .select({
        category: transactions.category,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month)))
      .groupBy(transactions.category);

    const categoryBreakdown: CategorySummary[] = categoryRows.map((r) => ({
      category: r.category,
      total: Number(r.total),
    }));

    // 2. 이번 달 총 지출 / 환불
    const monthTotals = await db
      .select({
        totalExpense: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
        totalRefund: sql<number>`sum(case when ${transactions.amount} < 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month)));

    const totalExpense = Number(monthTotals[0]?.totalExpense ?? 0);
    const totalRefund = Number(monthTotals[0]?.totalRefund ?? 0);
    const netExpense = totalExpense + totalRefund; // refund is negative

    // 3. 본인/가족별 합산
    const memberRows = await db
      .select({
        memberType: transactions.memberType,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month)))
      .groupBy(transactions.memberType);

    const memberBreakdown: MemberSummary[] = memberRows.map((r) => ({
      memberType: r.memberType,
      total: Number(r.total),
    }));

    // 4. 전월 총 지출
    const prev = getPreviousMonth(year, month);
    const prevTotals = await db
      .select({
        totalExpense: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(
        and(eq(transactions.year, prev.year), eq(transactions.month, prev.month))
      );

    const previousMonthExpense = Number(prevTotals[0]?.totalExpense ?? 0);
    const changeRate =
      previousMonthExpense > 0
        ? ((netExpense - previousMonthExpense) / previousMonthExpense) * 100
        : null;

    // 5. 이번 달 수입
    const incomeRows = await db
      .select({
        total: sql<number>`sum(${incomes.amount})`,
      })
      .from(incomes)
      .where(and(eq(incomes.year, year), eq(incomes.month, month)));

    const totalIncome = Number(incomeRows[0]?.total ?? 0);

    // 6. 적금 합산 (진행중인 적금)
    const savingsRows = await db
      .select({
        total: sql<number>`sum(${savings.monthlyAmount})`,
      })
      .from(savings)
      .where(sql`${savings.endDate} is null or ${savings.endDate} >= ${`${year}-${String(month).padStart(2, "0")}-01`}`);

    const totalSavings = Number(savingsRows[0]?.total ?? 0);

    // 7. 비율 계산
    const expenseToIncomeRatio =
      totalIncome > 0 ? (netExpense / totalIncome) * 100 : null;
    const savingsRate =
      totalIncome > 0 ? (totalSavings / totalIncome) * 100 : null;

    const data: DashboardData = {
      year,
      month,
      totalExpense,
      totalRefund,
      netExpense,
      categoryBreakdown,
      memberBreakdown,
      previousMonthExpense,
      changeRate,
      totalIncome,
      totalSavings,
      expenseToIncomeRatio,
      savingsRate,
    };

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "대시보드 데이터 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
