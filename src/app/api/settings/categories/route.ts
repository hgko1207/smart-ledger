import { NextResponse } from "next/server";
import { db } from "@/db";
import { categoryRules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface CategoryRuleInput {
  pattern: string;
  category: string;
  priority: number;
}

/**
 * GET: 카테고리 규칙 목록 조회
 */
export async function GET() {
  try {
    const rules = await db
      .select()
      .from(categoryRules)
      .orderBy(desc(categoryRules.priority));

    return NextResponse.json({ rules });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "카테고리 규칙 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 카테고리 규칙 추가
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CategoryRuleInput;

    if (!body.pattern || !body.category) {
      return NextResponse.json(
        { error: "패턴과 카테고리는 필수입니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await db.insert(categoryRules).values({
      id: crypto.randomUUID(),
      pattern: body.pattern,
      category: body.category,
      priority: body.priority ?? 0,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "카테고리 규칙 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 카테고리 규칙 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 규칙 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db.delete(categoryRules).where(eq(categoryRules.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "카테고리 규칙 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
