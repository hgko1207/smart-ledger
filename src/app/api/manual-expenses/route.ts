import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

type ManualCategory =
  | "헌금/기부"
  | "용돈/지원"
  | "계모임/회비"
  | "대출상환"
  | "이자"
  | "현금지출"
  | "계좌이체"
  | "기타";

interface ManualExpenseInput {
  date: string;
  description: string;
  amount: number;
  category: ManualCategory;
  isRecurring: number; // 0 or 1
}

interface ManualExpensePatchInput {
  id: string;
  date?: string;
  description?: string;
  amount?: number;
  category?: ManualCategory;
  isRecurring?: number;
}

/**
 * GET: cardCompany="manual"인 거래 조회 (year, month 필터)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const conditions = [eq(transactions.cardCompany, "manual")];
    if (yearParam) {
      conditions.push(eq(transactions.year, parseInt(yearParam, 10)));
    }
    if (monthParam) {
      conditions.push(eq(transactions.month, parseInt(monthParam, 10)));
    }

    const result = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date));

    return NextResponse.json({ expenses: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 새 수동 지출 추가
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualExpenseInput;

    if (!body.date || !body.description || !body.amount) {
      return NextResponse.json(
        { error: "날짜, 설명, 금액은 필수입니다." },
        { status: 400 }
      );
    }

    const d = new Date(body.date);
    const now = new Date().toISOString();

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      date: body.date,
      description: body.description,
      amount: body.amount,
      category: body.category || "기타",
      cardCompany: "manual",
      cardName: "",
      memberType: "본인",
      originalCategory: null,
      customCategory: null,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      statementFile: null,
      installmentTotal: null,
      installmentCurrent: null,
      installmentRemaining: null,
      isRecurring: body.isRecurring ?? 0,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH: 수동 지출 편집
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as ManualExpensePatchInput;

    if (!body.id) {
      return NextResponse.json(
        { error: "수정할 지출 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | null> = {};
    if (body.date !== undefined) {
      updates.date = body.date;
      const d = new Date(body.date);
      updates.month = d.getMonth() + 1;
      updates.year = d.getFullYear();
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.category !== undefined) updates.category = body.category;
    if (body.isRecurring !== undefined) updates.isRecurring = body.isRecurring;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "수정할 필드가 없습니다." },
        { status: 400 }
      );
    }

    await db
      .update(transactions)
      .set(updates)
      .where(
        and(eq(transactions.id, body.id), eq(transactions.cardCompany, "manual"))
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 수동 지출 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 지출 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db
      .delete(transactions)
      .where(
        and(eq(transactions.id, id), eq(transactions.cardCompany, "manual"))
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
