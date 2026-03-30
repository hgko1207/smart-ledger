import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, isNotNull, gt, sql } from "drizzle-orm";

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
}

export interface InstallmentsResponse {
  activeInstallments: InstallmentItem[];
  totalRemaining: number; // 총 남은 잔액
  monthlyPaymentTotal: number; // 월 총 할부 납부 예정액
  activeCount: number; // 진행 중 할부 건수
}

/**
 * GET: 현재 진행 중인 할부 목록 조회
 * 가장 최근 명세서 기준으로 installmentCurrent < installmentTotal인 거래
 */
export async function GET() {
  try {
    // 할부 정보가 있는 거래 조회 (installmentTotal이 NOT NULL이고 > 0)
    const installmentTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.installmentTotal),
          gt(transactions.installmentTotal, 0)
        )
      )
      .orderBy(sql`${transactions.date} DESC`);

    // 같은 가맹점+같은 할부기간에 대해 가장 최근 회차만 취하기
    // key: description + installmentTotal
    const latestByKey = new Map<string, typeof installmentTxs[number]>();
    for (const tx of installmentTxs) {
      const key = `${tx.description}_${tx.installmentTotal}`;
      const existing = latestByKey.get(key);
      if (!existing || tx.date > existing.date) {
        latestByKey.set(key, tx);
      }
    }

    // 진행 중인 할부만 필터 (현재 회차 < 총 회차)
    const activeInstallments: InstallmentItem[] = [];

    for (const tx of latestByKey.values()) {
      const total = tx.installmentTotal;
      const current = tx.installmentCurrent;
      if (total === null || current === null || total <= 0) continue;
      if (current >= total) continue; // 완료된 할부

      const remainingMonths = total - current;
      const remaining = tx.installmentRemaining ?? tx.amount * remainingMonths;
      const estimatedMonthly = remainingMonths > 0
        ? Math.round(remaining / remainingMonths)
        : tx.amount;

      activeInstallments.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        installmentTotal: total,
        installmentCurrent: current,
        installmentRemaining: remaining,
        remainingMonths,
        estimatedMonthlyPayment: estimatedMonthly,
      });
    }

    // 정렬: 남은 잔액 큰 순
    activeInstallments.sort((a, b) => b.installmentRemaining - a.installmentRemaining);

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
