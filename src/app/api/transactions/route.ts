import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import type { NewTransaction } from "@/db/schema";

// POST 요청 바디 타입
interface SaveTransactionInput {
  date: string;
  description: string;
  amount: number;
  category: string;
  cardName: string;
  memberType: "본인" | "가족";
  month: number;
  year: number;
  foreignCurrency: string | null;
  statementFile: string;
  installmentTotal: number | null;
  installmentCurrent: number | null;
  installmentRemaining: number | null;
}

interface SaveTransactionsBody {
  transactions: SaveTransactionInput[];
}

// GET 쿼리 파라미터 타입
interface TransactionFilters {
  year: number | null;
  month: number | null;
  category: string | null;
  memberType: string | null;
}

function parseFilters(url: URL): TransactionFilters {
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");
  return {
    year: yearParam ? parseInt(yearParam, 10) : null,
    month: monthParam ? parseInt(monthParam, 10) : null,
    category: url.searchParams.get("category"),
    memberType: url.searchParams.get("memberType"),
  };
}

/**
 * POST: 파싱된 거래 내역을 DB에 저장
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveTransactionsBody;

    if (!body.transactions || body.transactions.length === 0) {
      return NextResponse.json(
        { error: "저장할 거래 내역이 없습니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const newTransactions: NewTransaction[] = body.transactions.map((tx) => ({
      id: crypto.randomUUID(),
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      cardCompany: "hyundai",
      cardName: tx.cardName,
      memberType: tx.memberType,
      originalCategory: tx.category,
      customCategory: null,
      month: tx.month,
      year: tx.year,
      statementFile: tx.statementFile,
      installmentTotal: tx.installmentTotal ?? null,
      installmentCurrent: tx.installmentCurrent ?? null,
      installmentRemaining: tx.installmentRemaining ?? null,
      createdAt: now,
    }));

    // 배치 삽입
    await db.insert(transactions).values(newTransactions);

    return NextResponse.json({
      success: true,
      count: newTransactions.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "거래 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET: 필터링된 거래 내역 조회
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url);

    const conditions = [];

    if (filters.year !== null) {
      conditions.push(eq(transactions.year, filters.year));
    }
    if (filters.month !== null) {
      conditions.push(eq(transactions.month, filters.month));
    }
    if (filters.category) {
      conditions.push(eq(transactions.category, filters.category));
    }
    if (filters.memberType) {
      conditions.push(eq(transactions.memberType, filters.memberType));
    }

    const result =
      conditions.length > 0
        ? await db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(desc(transactions.date))
        : await db
            .select()
            .from(transactions)
            .orderBy(desc(transactions.date));

    return NextResponse.json({ transactions: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "거래 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH: 거래 수정 (카테고리, 메모 독립 처리)
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id: string; category?: string; memo?: string | null };

    if (!body.id) {
      return NextResponse.json(
        { error: "거래 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const updates: Record<string, string | null> = {};
    if (body.category !== undefined) {
      updates.category = body.category;
      updates.customCategory = body.category;
    }
    if (body.memo !== undefined) {
      updates.memo = body.memo;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "수정할 필드가 없습니다." },
        { status: 400 }
      );
    }

    await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, body.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "거래 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 특정 거래 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 거래 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db.delete(transactions).where(eq(transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "거래 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
