import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, isNotNull, gt, sql, lte } from "drizzle-orm";

// 할부 항목 응답 타입
export interface InstallmentItem {
  id: string;
  date: string;
  description: string;
  amount: number; // 이번 달 결제원금
  installmentTotal: number;
  installmentCurrent: number;
  installmentRemaining: number; // 결제후 남은 잔액
  remainingMonths: number; // 남은 개월수
  estimatedMonthlyPayment: number; // 월 예상 납부액
  completionDate: string; // 완료 예정 월 (YYYY-MM)
  isCompleted: boolean; // 완료 여부
}

export interface InstallmentsResponse {
  activeInstallments: InstallmentItem[];
  completedInstallments: InstallmentItem[];
  totalRemaining: number; // 총 남은 잔액
  monthlyPaymentTotal: number; // 월 총 할부 납부 예정액
  activeCount: number; // 진행 중 할부 건수
}

/**
 * 선택 월 기준 완료 예정 월 계산
 * 거래 날짜 + 남은 개월수로 추정
 */
function calcCompletionDate(txDate: string, installmentTotal: number, installmentCurrent: number): string {
  const d = new Date(txDate);
  // 현재 회차 기준으로, 완료까지 남은 개월 = total - current
  // 완료 예정월 = 거래월 + (total - current)
  const remaining = installmentTotal - installmentCurrent;
  const completionMonth = new Date(d.getFullYear(), d.getMonth() + remaining, 1);
  return `${completionMonth.getFullYear()}-${String(completionMonth.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET: 선택한 월 기준 할부 목록 조회
 * ?year=2026&month=2 → 해당 월 기준으로 아직 진행 중인 할부 + 해당 월에 완료된 할부
 *
 * 로직:
 * 1. 선택 월 이전/포함하는 모든 할부 거래를 조회
 * 2. 같은 가맹점+할부기간의 가장 최근(선택월 이하) 회차를 기준으로 판단
 * 3. installmentCurrent < installmentTotal → 아직 진행 중
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    // 할부 정보가 있는 모든 거래 조회
    const baseConditions = [
      isNotNull(transactions.installmentTotal),
      gt(transactions.installmentTotal, 0),
    ];

    // 선택 월이 있으면 해당 월 이전/포함하는 거래만 조회
    if (yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      // year-month를 YYYYMM 숫자로 만들어 비교
      // (year * 100 + month) 형태로 비교
      const targetYearMonth = year * 100 + month;
      baseConditions.push(
        lte(
          sql`(${transactions.year} * 100 + ${transactions.month})`,
          targetYearMonth
        )
      );
    }

    const installmentTxs = await db
      .select()
      .from(transactions)
      .where(and(...baseConditions))
      .orderBy(sql`${transactions.date} DESC`);

    // 같은 가맹점+같은 할부기간에 대해 가장 최근(선택월 이하) 회차만 취하기
    const latestByKey = new Map<string, typeof installmentTxs[number]>();
    for (const tx of installmentTxs) {
      const key = `${tx.description}_${tx.installmentTotal}`;
      const existing = latestByKey.get(key);
      if (!existing || tx.date > existing.date) {
        latestByKey.set(key, tx);
      }
    }

    const activeInstallments: InstallmentItem[] = [];
    const completedInstallments: InstallmentItem[] = [];

    for (const tx of latestByKey.values()) {
      const total = tx.installmentTotal;
      const current = tx.installmentCurrent;
      if (total === null || current === null || total <= 0) continue;

      const remainingMonths = Math.max(0, total - current);
      const remaining = tx.installmentRemaining ?? tx.amount * remainingMonths;
      const estimatedMonthly = remainingMonths > 0
        ? Math.round(remaining / remainingMonths)
        : tx.amount;
      const isCompleted = current >= total;
      const completionDate = calcCompletionDate(tx.date, total, current);

      const item: InstallmentItem = {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        installmentTotal: total,
        installmentCurrent: current,
        installmentRemaining: remaining,
        remainingMonths,
        estimatedMonthlyPayment: estimatedMonthly,
        completionDate,
        isCompleted,
      };

      if (isCompleted) {
        completedInstallments.push(item);
      } else {
        activeInstallments.push(item);
      }
    }

    // 정렬: 진행 중은 남은 잔액 큰 순, 완료는 날짜 최신 순
    activeInstallments.sort((a, b) => b.installmentRemaining - a.installmentRemaining);
    completedInstallments.sort((a, b) => b.date.localeCompare(a.date));

    const totalRemaining = activeInstallments.reduce(
      (sum, item) => sum + item.installmentRemaining,
      0
    );
    const monthlyPaymentTotal = activeInstallments.reduce(
      (sum, item) => sum + item.estimatedMonthlyPayment,
      0
    );

    const response: InstallmentsResponse = {
      activeInstallments,
      completedInstallments,
      totalRemaining,
      monthlyPaymentTotal,
      activeCount: activeInstallments.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "할부 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
