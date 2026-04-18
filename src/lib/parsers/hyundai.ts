import * as XLSX from "xlsx";

// 파싱된 거래 내역 타입
export interface ParsedTransaction {
  date: string; // ISO8601 (YYYY-MM-DD)
  description: string; // 가맹점명 (정제된)
  amount: number; // KRW 정수, 양수=결제, 음수=환불
  cardName: string; // 카드명 (예: ZERO 포인트형)
  memberType: "본인" | "가족"; // 본인/가족 구분
  month: number; // 1-12
  year: number;
  foreignCurrency: string | null; // 해외결제 시 통화:금액 (예: "JPY:2800.00")
  installmentTotal: number | null; // 총 할부 개월수 (예: 3, 10). null이면 일시불
  installmentCurrent: number | null; // 현재 회차 (예: 3, 2)
  installmentRemaining: number | null; // 결제후 남은 잔액 (원). 0이면 null
}

export interface HyundaiParseResult {
  transactions: ParsedTransaction[];
  statementMonth: number; // 명세서 월
  statementYear: number; // 명세서 년
  fileName: string;
  totalRows: number; // 전체 데이터 행 수
  skippedRows: number; // 스킵된 행 수
}

/**
 * 명세서 제목에서 년/월 추출
 * 예: "2026년 03월 이용대금명세서" → { year: 2026, month: 3 }
 */
function parseStatementTitle(title: string): { year: number; month: number } {
  const match = title.match(/(\d{4})년\s*(\d{1,2})월/);
  if (!match) {
    return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  }
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

/**
 * 한국어 날짜 파싱
 * 예: "2026년 02월 04일" → "2026-02-04"
 */
function parseKoreanDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) {
    return null;
  }
  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 금액 문자열 파싱 (쉼표 포함, 음수 처리)
 * 예: "4,700" → 4700, "-217,047" → -217047, "" → 0
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === "" || amountStr.trim() === "-") {
    return 0;
  }
  const cleaned = amountStr.replace(/,/g, "").trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 이용카드 컬럼에서 본인/가족 구분 및 카드명 추출
 * 예: "본인 ZERO 포인트형" → { memberType: "본인", cardName: "ZERO 포인트형" }
 * 예: "가족 ZERO 포인트형" → { memberType: "가족", cardName: "ZERO 포인트형" }
 */
function parseMemberAndCard(cardStr: string): {
  memberType: "본인" | "가족";
  cardName: string;
} {
  const trimmed = cardStr.trim();

  if (trimmed.startsWith("가족")) {
    return {
      memberType: "가족",
      cardName: trimmed.replace(/^가족\s*/, "").trim(),
    };
  }

  // 기본값은 "본인"
  return {
    memberType: "본인",
    cardName: trimmed.replace(/^본인\s*/, "").trim(),
  };
}

/**
 * 이용가맹점에서 가맹점명 추출 (뒤에 붙어있는 금액 제거)
 *
 * 패턴:
 * - "스타벅스코리아4,700" → "스타벅스코리아"
 * - "토스페이먼츠주식회사 - (주)비바리퍼블리12,000" → "토스페이먼츠주식회사 - (주)비바리퍼블리"
 * - "AEONMALL OKINAWA RYC,JPY:2800.0027,407" → "AEONMALL OKINAWA RYC"
 * - "연회비0" → "연회비"
 */
function parseMerchantName(rawMerchant: string): {
  name: string;
  foreignCurrency: string | null;
} {
  const trimmed = rawMerchant.trim();

  // 해외 결제 패턴: 가맹점명,통화코드:금액숫자 (예: ",JPY:2800.0027,407")
  const foreignMatch = trimmed.match(
    /^(.+?),([A-Z]{3}):(\d+[\d,.]*\d)$/
  );
  if (foreignMatch) {
    // 해외 결제: 통화 코드와 금액 분리
    // "AEONMALL OKINAWA RYC,JPY:2800.0027,407"
    // foreignMatch[1] = "AEONMALL OKINAWA RYC"
    // foreignMatch[2] = "JPY"
    // foreignMatch[3] = "2800.0027,407" (원래 외화금액 + 원화금액이 붙어있음)
    const currencyCode = foreignMatch[2];
    const amountPart = foreignMatch[3];

    // 외화 금액에서 소수점까지만 추출 (예: "2800.00" from "2800.0027,407")
    const foreignAmountMatch = amountPart.match(/^(\d+\.\d{2})/);
    const foreignAmount = foreignAmountMatch ? foreignAmountMatch[1] : amountPart;

    return {
      name: foreignMatch[1].trim(),
      foreignCurrency: `${currencyCode}:${foreignAmount}`,
    };
  }

  // 일반 가맹점: 뒤에서 연속된 숫자+쉼표 패턴 제거
  // "스타벅스코리아4,700" → "스타벅스코리아"
  // "연회비0" → "연회비"
  // 끝에서부터 숫자, 쉼표, 마이너스, 점으로 이루어진 부분을 제거
  const cleaned = trimmed.replace(/[-]?[\d,]+\.?\d*$/, "").trim();

  return {
    name: cleaned || trimmed,
    foreignCurrency: null,
  };
}

/**
 * 할부/회차 문자열 파싱
 * 예: "3/3" → { total: 3, current: 3 }
 * 예: "10/2" → { total: 10, current: 2 }
 * SheetJS가 "3/3"을 날짜 serial number로 변환할 수 있으므로 cell.w를 우선 사용
 */
function parseInstallment(cell: XLSX.CellObject | undefined): {
  total: number | null;
  current: number | null;
} {
  if (!cell) return { total: null, current: null };

  // cell.w (formatted text)를 우선 사용하여 날짜 해석 방지
  const raw = cell.w !== undefined ? cell.w : cell.v !== undefined ? String(cell.v) : "";
  const trimmed = raw.trim();

  if (!trimmed) return { total: null, current: null };

  // "총회차/현재회차" 패턴 매칭 (예: "3/3", "10/2")
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return { total: null, current: null };

  const total = parseInt(match[1], 10);
  const current = parseInt(match[2], 10);

  if (total <= 0 || current <= 0) return { total: null, current: null };

  return { total, current };
}

/**
 * 셀 값을 문자열로 안전하게 변환
 */
function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w; // 서식이 적용된 텍스트
  if (cell.v !== undefined) return String(cell.v);
  return "";
}

/**
 * 현대카드 엑셀 파서
 *
 * 엑셀 구조:
 * Row 1: "2026년 03월 이용대금명세서"
 * Row 2: "결제 상세내역"
 * Row 3: 이용일, 이용카드, 이용가맹점, 이용금액, 할부/회차, 적립/할인율(%), 예상적립/할인, 결제원금, 결제후잔액, 수수료(이자)
 * Row 4+: 데이터
 */
export function parseHyundaiExcel(
  buffer: ArrayBuffer,
  fileName: string
): HyundaiParseResult {
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

  // Row 1에서 명세서 년/월 추출
  const titleCell = cellToString(sheet["A1"]);
  const { year: statementYear, month: statementMonth } =
    parseStatementTitle(titleCell);

  // Row 3: 컬럼명 확인 (형식 변경 감지)
  const headerRow = cellToString(sheet["A3"]);
  if (!headerRow.includes("이용일")) {
    // 헤더가 다른 행에 있을 수 있으므로 검색
    throw new Error(
      "엑셀 형식이 예상과 다릅니다. Row 3에 '이용일' 헤더가 없습니다."
    );
  }

  // 시트 범위 파악
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const transactions: ParsedTransaction[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  // Row 4부터 데이터 읽기 (0-indexed로 row 3)
  for (let rowIdx = 3; rowIdx <= range.e.r; rowIdx++) {
    totalRows++;

    // 각 컬럼 읽기 (0-indexed)
    const dateCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })];
    const cardCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })];
    const merchantCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
    // 할부/회차: col[3] (D열)
    const installmentCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 3 })];
    // 결제원금: 헤더는 H(col7)이지만, 데이터에서 이용가맹점+이용금액이 합쳐져
    // 컬럼이 1칸 밀림. 실제 결제원금은 G(col6)에 위치.
    // col6이 0이고 col7에 값이 있으면 col7 사용 (일부 행은 밀리지 않음)
    const col6Cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 6 })];
    const col7Cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 7 })];
    const col6Val = parseAmount(cellToString(col6Cell));
    const col7Val = parseAmount(cellToString(col7Cell));
    const paymentPrincipalCell = col6Val !== 0 ? col6Cell : col7Cell; // 결제원금
    // 결제후잔액: col[7] (H열). 결제원금이 col6이면 잔액은 col7
    const remainingCell = col6Val !== 0 ? col7Cell : sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 8 })];
    const remainingVal = parseAmount(cellToString(remainingCell));

    const dateStr = cellToString(dateCell);
    const cardStr = cellToString(cardCell);
    const merchantStr = cellToString(merchantCell);
    const principalStr = cellToString(paymentPrincipalCell);

    // 빈 행 스킵
    if (!dateStr.trim()) {
      skippedRows++;
      continue;
    }

    // 소계/합계 행 스킵 (이용일이 "-"로 시작)
    if (dateStr.trim().startsWith("-") || dateStr.trim() === "-") {
      skippedRows++;
      continue;
    }

    // 날짜 파싱
    const parsedDate = parseKoreanDate(dateStr);
    if (!parsedDate) {
      skippedRows++;
      continue;
    }

    // 결제원금 파싱
    const amount = parseAmount(principalStr);

    // 결제원금이 0이면 스킵 (할부 예정 항목 등)
    if (amount === 0) {
      skippedRows++;
      continue;
    }

    // 이용카드에서 본인/가족 구분 및 카드명 추출
    const { memberType, cardName } = parseMemberAndCard(cardStr);

    // 가맹점명 추출
    const { name: merchantName, foreignCurrency } =
      parseMerchantName(merchantStr);

    // Date 객체에서 month, year 추출
    const [yearStr, monthStr] = parsedDate.split("-");
    const txYear = parseInt(yearStr, 10);
    const txMonth = parseInt(monthStr, 10);

    // 할부 정보 파싱
    const installment = parseInstallment(installmentCell);

    transactions.push({
      date: parsedDate,
      description: merchantName,
      amount,
      cardName,
      memberType,
      month: txMonth,
      year: txYear,
      foreignCurrency,
      installmentTotal: installment.total,
      installmentCurrent: installment.current,
      installmentRemaining: remainingVal !== 0 ? remainingVal : null,
    });
  }

  // 대표 월 결정: 가장 많은 거래가 속한 월로 통일
  // (4월 명세서에 할부 이전 회차 등 1~2월 거래가 섞여 있어도 전부 3월로 귀속)
  if (transactions.length > 0) {
    const monthCounts = new Map<string, number>();
    for (const tx of transactions) {
      const key = `${tx.year}-${tx.month}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
    let dominantKey = "";
    let maxCount = 0;
    for (const [key, count] of monthCounts) {
      if (count > maxCount) {
        dominantKey = key;
        maxCount = count;
      }
    }
    const [domYear, domMonth] = dominantKey.split("-").map(Number);
    for (const tx of transactions) {
      tx.month = domMonth;
      tx.year = domYear;
    }
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
