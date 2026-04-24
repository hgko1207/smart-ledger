import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

type ManualCategory =
  | "헌금/기부"
  | "용돈/지원"
  | "계모임/회비"
  | "주택대출"
  | "주택대출-원금"
  | "주택대출-이자"
  | "차량대출"
  | "차량대출-원금"
  | "차량대출-이자"
  | "가족대출"
  | "기타대출"
  | "기타대출-원금"
  | "기타대출-이자"
  | "현금지출"
  | "계좌이체"
  | "기타";

type Scope = "this" | "future" | "all";

interface ManualExpenseInput {
  date: string;
  description: string;
  amount: number;
  category: ManualCategory;
  isRecurring: number;
}

interface ManualExpensePatchInput {
  id: string;
  date?: string;
  description?: string;
  amount?: number;
  category?: ManualCategory;
  isRecurring?: number;
  scope?: Scope;
}

interface ManualExpenseSplitInput {
  id: string;
  interestAmount: number;
  scope: Scope;
}

/** legacy 대출 → 원금/이자 카테고리 매핑 */
const LOAN_PRINCIPAL_MAP: Record<string, ManualCategory> = {
  "주택대출": "주택대출-원금",
  "차량대출": "차량대출-원금",
  "기타대출": "기타대출-원금",
};
const LOAN_INTEREST_MAP: Record<string, ManualCategory> = {
  "주택대출": "주택대출-이자",
  "차량대출": "차량대출-이자",
  "기타대출": "기타대출-이자",
};

/** 문자열에서 " (원금)" / " (이자)" 접미어 제거 */
function stripSplitSuffix(desc: string): string {
  return desc.replace(/\s*\((원금|이자)\)\s*$/u, "");
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
 * POST: 새 수동 지출 추가 또는 반복 항목 일괄 복사, 또는 원금/이자 분리
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // 반복 항목을 이번 달로 일괄 복사
    if (action === "copy-recurring") {
      const targetYear = parseInt(url.searchParams.get("year") ?? "", 10);
      const targetMonth = parseInt(url.searchParams.get("month") ?? "", 10);
      if (!targetYear || !targetMonth) {
        return NextResponse.json({ error: "year, month 파라미터가 필요합니다." }, { status: 400 });
      }

      const recurring = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.cardCompany, "manual"), eq(transactions.isRecurring, 1)));

      const existing = await db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.cardCompany, "manual"),
          eq(transactions.year, targetYear),
          eq(transactions.month, targetMonth),
        ));

      const existingKeys = new Set(
        existing.map((tx) => `${tx.description}|${tx.amount}`)
      );

      const seenRecurring = new Set<string>();
      const uniqueRecurring = recurring.filter((tx) => {
        const key = `${tx.description}|${tx.amount}`;
        if (seenRecurring.has(key)) return false;
        seenRecurring.add(key);
        return true;
      });

      const now = new Date().toISOString();
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
      let copied = 0;

      for (const tx of uniqueRecurring) {
        const key = `${tx.description}|${tx.amount}`;
        if (existingKeys.has(key)) continue;

        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          date: dateStr,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          cardCompany: "manual",
          cardName: "",
          memberType: tx.memberType,
          originalCategory: null,
          customCategory: null,
          month: targetMonth,
          year: targetYear,
          statementFile: null,
          installmentTotal: null,
          installmentCurrent: null,
          installmentRemaining: null,
          isRecurring: 1,
          createdAt: now,
        });
        copied++;
      }

      return NextResponse.json({ success: true, copied });
    }

    // 반복 지출 일괄 생성 액션
    // scope: this(선택 월 1건) / future(선택 월~12월) / all(해당 연도 1~12월)
    // split 모드면 각 월에 원금+이자 2건씩 생성
    // 동일 (year, month, description, amount, category) 이미 있으면 skip
    if (action === "create-recurring") {
      const body = (await request.json()) as {
        date: string;
        description: string;
        amount: number;
        category: ManualCategory;
        scope: Scope;
        isRecurring?: number;
        split?: { interestAmount: number };
      };

      if (!body.date || !body.description || !body.amount || !body.category) {
        return NextResponse.json(
          { error: "date, description, amount, category는 필수입니다." },
          { status: 400 }
        );
      }

      const d = new Date(body.date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "잘못된 날짜 형식입니다." }, { status: 400 });
      }
      const year = d.getFullYear();
      const baseMonth = d.getMonth() + 1;
      const day = d.getDate();

      let months: number[];
      if (body.scope === "this") {
        months = [baseMonth];
      } else if (body.scope === "future") {
        months = [];
        for (let m = baseMonth; m <= 12; m++) months.push(m);
      } else {
        months = [];
        for (let m = 1; m <= 12; m++) months.push(m);
      }

      // 생성할 엔트리 준비 (split이면 원금+이자 2건, 아니면 1건)
      const entries: Array<{
        description: string;
        amount: number;
        category: ManualCategory;
      }> = [];
      if (body.split) {
        if (body.split.interestAmount <= 0 || body.split.interestAmount >= body.amount) {
          return NextResponse.json(
            { error: "이자 금액이 유효하지 않습니다." },
            { status: 400 }
          );
        }
        const principalCat = LOAN_PRINCIPAL_MAP[body.category];
        const interestCat = LOAN_INTEREST_MAP[body.category];
        if (!principalCat || !interestCat) {
          return NextResponse.json(
            { error: "이 카테고리는 원금/이자 분리를 지원하지 않습니다." },
            { status: 400 }
          );
        }
        const principalAmount = body.amount - body.split.interestAmount;
        entries.push({
          description: `${body.description} (원금)`,
          amount: principalAmount,
          category: principalCat,
        });
        entries.push({
          description: `${body.description} (이자)`,
          amount: body.split.interestAmount,
          category: interestCat,
        });
      } else {
        entries.push({
          description: body.description,
          amount: body.amount,
          category: body.category,
        });
      }

      const now = new Date().toISOString();
      const recurringFlag = body.isRecurring ?? 1;
      let created = 0;
      let skipped = 0;

      // 대상 월의 말일 계산 helper — 1/31 기준이면 2월은 28/29로 자동 보정
      function clampDay(y: number, m: number, preferredDay: number): number {
        const lastDay = new Date(y, m, 0).getDate();
        return Math.min(preferredDay, lastDay);
      }

      for (const m of months) {
        const actualDay = clampDay(year, m, day);
        const monthDate = `${year}-${String(m).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;

        for (const entry of entries) {
          const existing = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
              and(
                eq(transactions.cardCompany, "manual"),
                eq(transactions.year, year),
                eq(transactions.month, m),
                eq(transactions.description, entry.description),
                eq(transactions.amount, entry.amount),
                eq(transactions.category, entry.category)
              )
            )
            .limit(1);
          if (existing.length > 0) {
            skipped++;
            continue;
          }

          await db.insert(transactions).values({
            id: crypto.randomUUID(),
            date: monthDate,
            description: entry.description,
            amount: entry.amount,
            category: entry.category,
            cardCompany: "manual",
            cardName: "",
            memberType: "본인",
            originalCategory: null,
            customCategory: null,
            month: m,
            year,
            statementFile: null,
            installmentTotal: null,
            installmentCurrent: null,
            installmentRemaining: null,
            isRecurring: recurringFlag,
            memo: null,
            createdAt: now,
          });
          created++;
        }
      }

      return NextResponse.json({ success: true, created, skipped });
    }

    // 원금/이자 분리 액션
    if (action === "split") {
      const body = (await request.json()) as ManualExpenseSplitInput;
      if (!body.id || !body.interestAmount || !body.scope) {
        return NextResponse.json(
          { error: "id, interestAmount, scope는 필수입니다." },
          { status: 400 }
        );
      }

      const targetRows = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, body.id), eq(transactions.cardCompany, "manual")))
        .limit(1);
      const target = targetRows[0];
      if (!target) {
        return NextResponse.json({ error: "대상 지출을 찾을 수 없습니다." }, { status: 404 });
      }

      const principalCat = LOAN_PRINCIPAL_MAP[target.category];
      const interestCat = LOAN_INTEREST_MAP[target.category];
      if (!principalCat || !interestCat) {
        return NextResponse.json(
          { error: "이 카테고리는 원금/이자 분리를 지원하지 않습니다." },
          { status: 400 }
        );
      }

      // 대상 행 결정
      // 매칭 기준: cardCompany='manual' + 동일 description + amount + category
      // (isRecurring 플래그는 매칭에 사용하지 않음 — 과거 수동 입력건도 포함)
      let rows;
      if (body.scope === "this") {
        rows = [target];
      } else {
        const baseRank = target.year * 12 + target.month;
        const matchConds = [
          eq(transactions.cardCompany, "manual"),
          eq(transactions.description, target.description),
          eq(transactions.amount, target.amount),
          eq(transactions.category, target.category),
        ];
        if (body.scope === "future") {
          matchConds.push(
            sql`(${transactions.year} * 12 + ${transactions.month}) >= ${baseRank}`
          );
        }
        rows = await db
          .select()
          .from(transactions)
          .where(and(...matchConds));
      }

      const now = new Date().toISOString();
      let processed = 0;

      for (const row of rows) {
        if (body.interestAmount >= row.amount) continue;
        const principalAmount = row.amount - body.interestAmount;
        const baseDesc = stripSplitSuffix(row.description);

        // 원본 → 원금
        await db
          .update(transactions)
          .set({
            description: `${baseDesc} (원금)`,
            amount: principalAmount,
            category: principalCat,
          })
          .where(eq(transactions.id, row.id));

        // 이자 새 행
        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          date: row.date,
          description: `${baseDesc} (이자)`,
          amount: body.interestAmount,
          category: interestCat,
          cardCompany: "manual",
          cardName: "",
          memberType: row.memberType,
          originalCategory: null,
          customCategory: null,
          month: row.month,
          year: row.year,
          statementFile: null,
          installmentTotal: null,
          installmentCurrent: null,
          installmentRemaining: null,
          isRecurring: row.isRecurring,
          memo: null,
          createdAt: now,
        });

        processed++;
      }

      return NextResponse.json({ success: true, processed });
    }

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
 * scope: "this" | "future" | "all" (반복 항목일 때만 효과)
 *   - this/미지정: id 단건
 *   - future: 매칭되는 반복 항목 중 (year,month) >= 대상
 *   - all: 매칭되는 모든 반복 항목
 * 매칭 기준: cardCompany='manual', isRecurring=1, 동일 description/amount/category (변경 전 값)
 * 날짜(date)는 bulk 모드에서 무시 (각 월의 원래 날짜 유지)
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

    const scope: Scope = body.scope ?? "this";

    // 단건 모드 (기존 동작)
    if (scope === "this") {
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

      return NextResponse.json({ success: true, affected: 1 });
    }

    // Bulk 모드 (future/all)
    // 매칭 기준: cardCompany='manual' + 동일 description + amount + category
    // (isRecurring 플래그는 매칭에 사용하지 않음)
    const targetRows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, body.id), eq(transactions.cardCompany, "manual")))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "대상 지출을 찾을 수 없습니다." }, { status: 404 });
    }

    const matchConds = [
      eq(transactions.cardCompany, "manual"),
      eq(transactions.description, target.description),
      eq(transactions.amount, target.amount),
      eq(transactions.category, target.category),
    ];
    if (scope === "future") {
      const baseRank = target.year * 12 + target.month;
      matchConds.push(
        sql`(${transactions.year} * 12 + ${transactions.month}) >= ${baseRank}`
      );
    }

    // bulk에서는 date 필드 무시
    const updates: Record<string, string | number | null> = {};
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

    const result = await db
      .update(transactions)
      .set(updates)
      .where(and(...matchConds))
      .returning({ id: transactions.id });

    return NextResponse.json({ success: true, affected: result.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 수동 지출 삭제
 * scope: this(default) | future | all
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const scope = (url.searchParams.get("scope") as Scope | null) ?? "this";

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 지출 ID가 필요합니다." },
        { status: 400 }
      );
    }

    if (scope === "this") {
      await db
        .delete(transactions)
        .where(
          and(eq(transactions.id, id), eq(transactions.cardCompany, "manual"))
        );
      return NextResponse.json({ success: true, affected: 1 });
    }

    const targetRows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.cardCompany, "manual")))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "대상 지출을 찾을 수 없습니다." }, { status: 404 });
    }

    // 매칭 기준: cardCompany='manual' + 동일 description + amount + category
    // (isRecurring 플래그는 매칭에 사용하지 않음)
    const matchConds = [
      eq(transactions.cardCompany, "manual"),
      eq(transactions.description, target.description),
      eq(transactions.amount, target.amount),
      eq(transactions.category, target.category),
    ];
    if (scope === "future") {
      const baseRank = target.year * 12 + target.month;
      matchConds.push(
        sql`(${transactions.year} * 12 + ${transactions.month}) >= ${baseRank}`
      );
    }

    const result = await db
      .delete(transactions)
      .where(and(...matchConds))
      .returning({ id: transactions.id });

    return NextResponse.json({ success: true, affected: result.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기타 지출 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
