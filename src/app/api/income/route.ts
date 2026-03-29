import { NextResponse } from "next/server";
import { db } from "@/db";
import { incomes } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

interface IncomeInput {
  date: string;
  source: "salary" | "bonus" | "other";
  amount: number;
  description: string | null;
}

/**
 * GET: 수입 목록 조회 (월/년 필터)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const conditions = [];
    if (yearParam) {
      conditions.push(eq(incomes.year, parseInt(yearParam, 10)));
    }
    if (monthParam) {
      conditions.push(eq(incomes.month, parseInt(monthParam, 10)));
    }

    const result =
      conditions.length > 0
        ? await db
            .select()
            .from(incomes)
            .where(and(...conditions))
            .orderBy(desc(incomes.date))
        : await db
            .select()
            .from(incomes)
            .orderBy(desc(incomes.date));

    return NextResponse.json({ incomes: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "수입 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 수입 추가
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomeInput;

    if (!body.date || !body.source || !body.amount) {
      return NextResponse.json(
        { error: "날짜, 유형, 금액은 필수입니다." },
        { status: 400 }
      );
    }

    const d = new Date(body.date);
    const now = new Date().toISOString();

    await db.insert(incomes).values({
      id: crypto.randomUUID(),
      date: body.date,
      source: body.source,
      amount: body.amount,
      description: body.description ?? null,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "수입 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 수입 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 수입 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db.delete(incomes).where(eq(incomes.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "수입 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
