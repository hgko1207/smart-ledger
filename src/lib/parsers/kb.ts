import * as XLSX from "xlsx";
import type { ParsedTransaction } from "./hyundai";

// 국민카드 파싱 결과 타입
export interface KBParseResult {
  transactions: ParsedTransaction[];
  statementMonth: number; // 명세서 월
  statementYear: number; // 명세서 년
  fileName: string;
  totalRows: number; // 전체 데이터 행 수
  skippedRows: number; // 스킵된 행 수
}

/**
 * 셀 값을 문자열로 안전하게 변환
 */
function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return String(cell.v);
  return "";
}

/**
 * 셀 값을 숫자로 안전하게 변환
 */
function cellToNumber(cell: XLSX.CellObject | undefined): number {
  if (!cell) return 0;
  if (cell.v !== undefined && typeof cell.v === "number") return cell.v;
  const str = cellToString(cell).replace(/,/g, "").trim();
  if (!str) return 0;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 국민카드 날짜 파싱
 * "25.12.03" → "2025-12-03" (YY.MM.DD → YYYY-MM-DD)
 */
function parseKBDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;

  const year = `20${match[1]}`;
  const month = match[2];
  const day = match[3];
  return `${year}-${month}-${day}`;
}

/**
 * 파일명에서 명세서 년/월 추출
 * "국민카드_202601.xlsx" → { year: 2026, month: 1 }
 */
function parseStatementFromFileName(fileName: string): {
  year: number;
  month: number;
} {
  const match = fileName.match(/(\d{4})(\d{2})/);
  if (!match) {
    return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  }
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

/**
 * 스킵해야 하는 행인지 확인
 */
function shouldSkipRow(row: (XLSX.CellObject | undefined)[]): boolean {
  // 전체 행을 문자열로 합쳐서 검사
  const rowText = row.map((c) => cellToString(c)).join(" ");

  if (rowText.includes("본인회원 소 계")) return true;
  if (rowText.includes("합 계")) return true;
  if (rowText.includes("무이자혜택금액")) return true;

  return false;
}

/**
 * 국민카드 엑셀 파서
 *
 * 엑셀 구조:
 * Row 0: 헤더1 (이용일자, 이용카드, 구분, 이용하신 가맹점, ..., 이용금액, 할부개월, ...)
 * Row 1: 헤더2 (서브헤더 — 회차, 원금, 수수료 등)
 * Row 2+: 데이터
 *
 * 컬럼:
 * [0] 이용일자  [1] 이용카드  [2] 구분  [3] 이용하신 가맹점
 * [4] (빈)  [5] 이용금액  [6] 할부개월  [7] 회차
 * [8] 원금  [9] 수수료  [10] 잔액회차  [11] 잔액원금  [12] 적립예정포인트
 */
export function parseKBExcel(
  buffer: ArrayBuffer,
  fileName: string
): KBParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    codepage: 949, // EUC-KR
    cellStyles: true,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("엑셀 파일에 시트가 없습니다.");
  }

  // 파일명에서 명세서 년/월 추출
  const { year: statementYear, month: statementMonth } =
    parseStatementFromFileName(fileName);

  // 시트 범위 파악 — 국민카드는 B2부터 시작할 수 있음
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const startCol = range.s.c; // 실제 시작 컬럼 (보통 1=B열)
  const transactions: ParsedTransaction[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  // 헤더 2행 건너뛰고 데이터 시작 (범위 시작행 + 2)
  const dataStartRow = range.s.r + 2;
  for (let rowIdx = dataStartRow; rowIdx <= range.e.r; rowIdx++) {
    totalRows++;

    // 행의 모든 셀 읽기 (시작 컬럼 기준 상대 위치)
    const cells: (XLSX.CellObject | undefined)[] = [];
    for (let colIdx = 0; colIdx <= 12; colIdx++) {
      cells.push(
        sheet[XLSX.utils.encode_cell({ r: rowIdx, c: startCol + colIdx })]
      );
    }

    // 소계/합계/무이자혜택 행 스킵
    if (shouldSkipRow(cells)) {
      skippedRows++;
      continue;
    }

    // 이용일자 확인
    const dateStr = cellToString(cells[0]);
    if (!dateStr.trim()) {
      skippedRows++;
      continue;
    }

    // 날짜 파싱
    const parsedDate = parseKBDate(dateStr);
    if (!parsedDate) {
      skippedRows++;
      continue;
    }

    // 원금 (col[8]) 확인 — 이번달 결제 원금
    const principal = cellToNumber(cells[8]);
    if (principal === 0) {
      skippedRows++;
      continue;
    }

    // 가맹점명
    const merchantName = cellToString(cells[3]).trim();
    if (!merchantName) {
      skippedRows++;
      continue;
    }

    // 카드명
    const cardName = cellToString(cells[1]).trim();

    // 할부 정보
    const installmentMonths = cellToNumber(cells[6]); // 할부개월
    const currentInstallment = cellToNumber(cells[7]); // 현재 회차
    const remainingBalance = cellToNumber(cells[11]); // 잔액 원금

    // 날짜에서 year, month 추출
    const [yearStr, monthStr] = parsedDate.split("-");
    const txYear = parseInt(yearStr, 10);
    const txMonth = parseInt(monthStr, 10);

    transactions.push({
      date: parsedDate,
      description: merchantName,
      amount: principal,
      cardName: cardName || "국민카드",
      memberType: "본인", // 국민카드는 본인만
      month: txMonth,
      year: txYear,
      foreignCurrency: null, // 국민카드 명세서에 해외결제 통화 정보 없음
      installmentTotal: installmentMonths > 0 ? installmentMonths : null,
      installmentCurrent: currentInstallment > 0 ? currentInstallment : null,
      installmentRemaining: remainingBalance > 0 ? remainingBalance : null,
    });
  }

  return {
    transactions,
    statementMonth,
    statementYear,
    fileName,
    totalRows,
    skippedRows,
  };
}
