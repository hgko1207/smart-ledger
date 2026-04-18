import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, incomes, savings } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

interface MonthlyDataRow {
  month: number;
  expense: number;
  income: number;
}

interface CategoryTotalRow {
  category: string;
  total: number;
}

interface AnnualReportResponse {
  year: number;
  monthlyData: MonthlyDataRow[];
  categoryTotals: CategoryTotalRow[];
  totalExpense: number;
  totalIncome: number;
  totalSavings: number;
  avgMonthlyExpense: number;
  topMonth: { month: number; expense: number };
  bottomMonth: { month: number; expense: number };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // 1. 월별 지출 집계
    const expenseRows = await db
      .select({
        month: transactions.month,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(eq(transactions.year, year))
      .groupBy(transactions.month);

    // 2. 월별 수입 집계
    const incomeRows = await db
      .select({
        month: incomes.month,
        total: sql<number>`sum(${incomes.amount})`,
      })
      .from(incomes)
      .where(eq(incomes.year, year))
      .groupBy(incomes.month);

    // 3. 적금 총액 (해당 연도에 활성 상태인 적금)
    const savingsRows = await db
      .select({
        monthlyAmount: savings.monthlyAmount,
        startDate: savings.startDate,
        endDate: savings.endDate,
      })
      .from(savings);

    // 적금: 해당 연도에 활성인 적금의 월납입액 * 활성 개월수
    let totalSavings = 0;
    for (const s of savingsRows) {
      const startYear = parseInt(s.startDate.substring(0, 4), 10);
      const startMonth = parseInt(s.startDate.substring(5, 7), 10);
      const endYear = s.endDate
        ? parseInt(s.endDate.substring(0, 4), 10)
        : year;
      const endMonth = s.endDate
        ? parseInt(s.endDate.substring(5, 7), 10)
        : 12;

      // 해당 연도 범위 내 활성 개월 계산
      const activeStart =
        startYear < year ? 1 : startYear === year ? startMonth : 13;
      const activeEnd =
        endYear > year ? 12 : endYear === year ? endMonth : 0;

      if (activeStart <= 12 && activeEnd >= 1) {
        const months = Math.max(0, activeEnd - activeStart + 1);
        totalSavings += s.monthlyAmount * months;
      }
    }

    // 4. 카테고리별 연간 합계
    const categoryRows = await db
      .select({
        category: transactions.category,
        total: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
      })
      .from(transactions)
      .where(eq(transactions.year, year))
      .groupBy(transactions.category)
      .orderBy(
        sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end) desc`
      );

    // 12개월 데이터 조합 (데이터 없는 달은 0)
    const expenseMap = new Map<number, number>();
    for (const r of expenseRows) {
      expenseMap.set(r.month, Number(r.total));
    }
    const incomeMap = new Map<number, number>();
    for (const r of incomeRows) {
      incomeMap.set(r.month, Number(r.total));
    }

    const monthlyData: MonthlyDataRow[] = [];
    for (let m = 1; m <= 12; m++) {
      monthlyData.push({
        month: m,
        expense: expenseMap.get(m) ?? 0,
        income: incomeMap.get(m) ?? 0,
      });
    }

    const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0);
    const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0);

    // 데이터가 있는 달만으로 평균 계산
    const monthsWithData = monthlyData.filter((d) => d.expense > 0);
    const avgMonthlyExpense =
      monthsWithData.length > 0
        ? Math.round(totalExpense / monthsWithData.length)
        : 0;

    // 가장 많이/적게 쓴 달 (데이터 있는 달 기준)
    let topMonth = { month: 1, expense: 0 };
    let bottomMonth = { month: 1, expense: Number.MAX_SAFE_INTEGER };

    if (monthsWithData.length > 0) {
      for (const d of monthsWithData) {
        if (d.expense > topMonth.expense) {
          topMonth = { month: d.month, expense: d.expense };
        }
        if (d.expense < bottomMonth.expense) {
          bottomMonth = { month: d.month, expense: d.expense };
        }
      }
    } else {
      bottomMonth = { month: 1, expense: 0 };
    }

    const categoryTotals: CategoryTotalRow[] = categoryRows
      .filter((r) => Number(r.total) > 0)
      .map((r) => ({
        category: r.category,
        total: Number(r.total),
      }));

    const data: AnnualReportResponse = {
      year,
      monthlyData,
      categoryTotals,
      totalExpense,
      totalIncome,
      totalSavings,
      avgMonthlyExpense,
      topMonth,
      bottomMonth,
    };

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "연간 리포트 데이터 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
