import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq } from "drizzle-orm";

interface BudgetInput {
  category: string;
  monthlyLimit: number;
}

/**
 * GET: 전체 예산 목록 조회
 */
export async function GET() {
  try {
    const rows = await db.select().from(budgets);
    return NextResponse.json({ budgets: rows });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "예산 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 예산 추가/수정 (upsert by category)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BudgetInput;

    if (!body.category || !body.monthlyLimit || body.monthlyLimit <= 0) {
      return NextResponse.json(
        { error: "카테고리와 유효한 월간 한도는 필수입니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 같은 카테고리가 있으면 업데이트, 없으면 추가
    const existing = await db
      .select()
      .from(budgets)
      .where(eq(budgets.category, body.category));

    if (existing.length > 0) {
      await db
        .update(budgets)
        .set({ monthlyLimit: body.monthlyLimit })
        .where(eq(budgets.category, body.category));
    } else {
      await db.insert(budgets).values({
        id: crypto.randomUUID(),
        category: body.category,
        monthlyLimit: body.monthlyLimit,
        createdAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "예산 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 예산 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 예산 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db.delete(budgets).where(eq(budgets.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "예산 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
