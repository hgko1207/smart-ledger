import { NextResponse } from "next/server";
import { db } from "@/db";
import { savings } from "@/db/schema";
import { eq } from "drizzle-orm";

interface SavingsInput {
  name: string;
  monthlyAmount: number;
  startDate: string;
  endDate: string | null;
}

/**
 * GET: 적금 목록 조회
 */
export async function GET() {
  try {
    const result = await db.select().from(savings);

    return NextResponse.json({ savings: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "적금 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 적금 추가
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavingsInput;

    if (!body.name || !body.monthlyAmount || !body.startDate) {
      return NextResponse.json(
        { error: "적금명, 월 납입액, 시작일은 필수입니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await db.insert(savings).values({
      id: crypto.randomUUID(),
      name: body.name,
      monthlyAmount: body.monthlyAmount,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "적금 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 적금 삭제
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 적금 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await db.delete(savings).where(eq(savings.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "적금 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
