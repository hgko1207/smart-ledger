import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, isNotNull, gt, sql } from "drizzle-orm";

export interface InstallmentItem {
  id: string;
  date: string; // 구매일
  description: string;
  amount: number; // 월 납부액 (1회차 기준)
  installmentTotal: number;
  installmentCurrent: number; // 선택 월 기준 예상 회차
  installmentRemaining: number; // 남은 잔액
  remainingMonths: number;
  estimatedMonthlyPayment: number;
  completionDate: string; // YYYY-MM
  isCompleted: boolean;
}

export interface InstallmentsResponse {
  activeInstallments: InstallmentItem[];
  completedInstallments: InstallmentItem[];
  totalRemaining: number;
  monthlyPaymentTotal: number;
  activeCount: number;
}

/**
 * 두 날짜 사이의 월수 차이 계산
 * 카드 명세서는 대략 구매월 +1개월 후부터 청구 시작
 */
function monthsBetween(fromDate: string, toYear: number, toMonth: number): number {
  const d = new Date(fromDate);
  const fromYear = d.getFullYear();
  const fromMonth = d.getMonth() + 1; // 1-indexed
  // 구매월의 다음 달부터 1회차 청구 → +1
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

/**
 * GET: 선택 월 기준 할부 상태 조회
 *
 * 새 로직:
 * 1. 모든 할부 거래에서 "가맹점+할부기간"별로 가장 낮은 installment_current(=첫 회차) 행을 찾음
 * 2. 구매일 + 할부 총 기간으로 "선택 월이면 몇 회차인지" 계산
 * 3. 계산된 회차 < 총 회차 → 진행 중 / >= 총 회차 → 완료
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const now = new Date();
    const selectedYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const selectedMonth = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    // 할부 거래 전체 조회
    const installmentTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.installmentTotal),
          gt(transactions.installmentTotal, 0)
        )
      )
      .orderBy(sql`${transactions.date} ASC`);

    // 가맹점+할부기간별로 첫 회차(가장 낮은 installment_current) 찾기
    // 이게 "이 할부가 시작된 시점"의 정보
    const firstByKey = new Map<string, typeof installmentTxs[number]>();
    for (const tx of installmentTxs) {
      if (tx.installmentTotal === null || tx.installmentCurrent === null) continue;
      const key = `${tx.description}_${tx.installmentTotal}`;
      const existing = firstByKey.get(key);
      if (!existing || tx.installmentCurrent < existing.installmentCurrent!) {
        firstByKey.set(key, tx);
      }
    }

    const activeInstallments: InstallmentItem[] = [];
    const completedInstallments: InstallmentItem[] = [];

    for (const tx of firstByKey.values()) {
      const total = tx.installmentTotal!;
      const firstCurrent = tx.installmentCurrent!; // DB에 기록된 첫 회차

      // 선택 월 기준 예상 회차 계산
      // 구매일로부터 선택 월까지 몇 개월 지났는지
      const monthsElapsed = monthsBetween(tx.date, selectedYear, selectedMonth);

      // 실제 예상 회차 = 첫 회차 + (경과 월 - 1) [첫 회차가 1이면 0개월 경과]
      // 좀 더 정확하게: DB의 첫 회차(firstCurrent)가 기록된 시점이 기준
      // 첫 회차가 1/3이고 구매월이 12월이면, 1월=2/3, 2월=3/3
      const expectedCurrent = Math.min(
        firstCurrent + Math.max(0, monthsElapsed - 1),
        total
      );

      // 선택 월이 구매 전이면 아직 할부 시작 안 함
      if (monthsElapsed < 1) continue;

      const isCompleted = expectedCurrent >= total;
      const remainingMonths = Math.max(0, total - expectedCurrent);
      const monthlyPayment = tx.amount; // 1회차 납부액을 월 납부액으로 사용
      const remaining = monthlyPayment * remainingMonths;

      // 완료 예정월
      const purchaseDate = new Date(tx.date);
      const completionMonth = new Date(
        purchaseDate.getFullYear(),
        purchaseDate.getMonth() + total,
        1
      );
      const completionDate = `${completionMonth.getFullYear()}-${String(completionMonth.getMonth() + 1).padStart(2, "0")}`;

      const item: InstallmentItem = {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: monthlyPayment,
        installmentTotal: total,
        installmentCurrent: expectedCurrent,
        installmentRemaining: remaining,
        remainingMonths,
        estimatedMonthlyPayment: monthlyPayment,
        completionDate,
        isCompleted,
      };

      if (isCompleted) {
        completedInstallments.push(item);
      } else {
        activeInstallments.push(item);
      }
    }

    activeInstallments.sort((a, b) => b.installmentRemaining - a.installmentRemaining);
    completedInstallments.sort((a, b) => b.date.localeCompare(a.date));

    const totalRemaining = activeInstallments.reduce(
      (sum, item) => sum + item.installmentRemaining, 0
    );
    const monthlyPaymentTotal = activeInstallments.reduce(
      (sum, item) => sum + item.estimatedMonthlyPayment, 0
    );

    return NextResponse.json({
      activeInstallments,
      completedInstallments,
      totalRemaining,
      monthlyPaymentTotal,
      activeCount: activeInstallments.length,
    } satisfies InstallmentsResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "할부 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
