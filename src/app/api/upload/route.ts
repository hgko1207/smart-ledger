import { NextResponse } from "next/server";
import { parseHyundaiExcel } from "@/lib/parsers/hyundai";
import { categorizeAll } from "@/lib/parsers/categorizer";
import {
  detectDuplicates,
  detectInternalDuplicates,
} from "@/lib/parsers/duplicate-detector";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { ParsedTransaction } from "@/lib/parsers/hyundai";
import type { DuplicateCandidate } from "@/lib/parsers/duplicate-detector";

// 카테고리가 포함된 파싱 결과
export interface CategorizedTransaction extends ParsedTransaction {
  category: string;
}

export interface UploadResponse {
  transactions: CategorizedTransaction[];
  duplicates: DuplicateCandidate[];
  internalDuplicates: number[][];
  statementMonth: number;
  statementYear: number;
  fileName: string;
  totalRows: number;
  skippedRows: number;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "파일이 첨부되지 않았습니다." },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const fileName = file.name;
    if (!fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "엑셀 파일(.xls, .xlsx)만 업로드 가능합니다." },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 읽기
    const buffer = await file.arrayBuffer();

    // 현대카드 파서로 파싱
    const parseResult = parseHyundaiExcel(buffer, fileName);

    if (parseResult.transactions.length === 0) {
      return NextResponse.json(
        { error: "파싱된 거래 내역이 없습니다. 파일 형식을 확인해주세요." },
        { status: 400 }
      );
    }

    // 카테고리 자동 분류
    const merchantNames = parseResult.transactions.map((tx) => tx.description);
    const categories = await categorizeAll(merchantNames);

    const categorized: CategorizedTransaction[] = parseResult.transactions.map(
      (tx, i) => ({
        ...tx,
        category: categories[i],
      })
    );

    // 기존 DB 거래와 중복 비교
    const existingTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.year, parseResult.statementYear),
          eq(transactions.month, parseResult.statementMonth)
        )
      );

    const duplicates = detectDuplicates(
      parseResult.transactions,
      existingTransactions
    );

    // 파일 내 자체 중복 감지
    const internalDuplicates = detectInternalDuplicates(
      parseResult.transactions
    );

    const response: UploadResponse = {
      transactions: categorized,
      duplicates,
      internalDuplicates,
      statementMonth: parseResult.statementMonth,
      statementYear: parseResult.statementYear,
      fileName: parseResult.fileName,
      totalRows: parseResult.totalRows,
      skippedRows: parseResult.skippedRows,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "파일 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
