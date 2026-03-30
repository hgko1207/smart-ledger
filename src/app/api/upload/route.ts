import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseHyundaiExcel } from "@/lib/parsers/hyundai";
import { parseKBExcel } from "@/lib/parsers/kb";
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

    // 카드사 자동 감지: 시트 내 헤더 행 확인
    const detectWorkbook = XLSX.read(buffer, {
      type: "array",
      codepage: 949,
      sheetRows: 5, // 헤더 확인용 5행만 읽기
    });
    const detectSheet = detectWorkbook.Sheets[detectWorkbook.SheetNames[0]];
    // 시트의 모든 셀 값을 합쳐서 "이용일자" 키워드 존재 여부로 국민카드 판별
    let sheetText = "";
    if (detectSheet) {
      const detectRange = XLSX.utils.decode_range(
        detectSheet["!ref"] ?? "A1"
      );
      for (let r = detectRange.s.r; r <= detectRange.e.r; r++) {
        for (let c = detectRange.s.c; c <= detectRange.e.c; c++) {
          const cell =
            detectSheet[XLSX.utils.encode_cell({ r, c })] as
              | XLSX.CellObject
              | undefined;
          if (cell?.v !== undefined) sheetText += String(cell.v) + " ";
        }
      }
    }

    // "이용일자" 키워드가 있으면 국민카드, 아니면 현대카드
    const isKB = sheetText.includes("이용일자");
    const parseResult = isKB
      ? parseKBExcel(buffer, fileName)
      : parseHyundaiExcel(buffer, fileName);

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
