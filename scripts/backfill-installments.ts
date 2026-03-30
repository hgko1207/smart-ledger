/**
 * 기존 DB 거래에 할부 정보를 엑셀 파일에서 추출하여 매칭 업데이트하는 스크립트
 *
 * 실행: npx tsx scripts/backfill-installments.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, and } from "drizzle-orm";
import * as schema from "../src/db/schema";

// DB 설정 (환경변수 또는 로컬)
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });
const db = drizzle(client, { schema });

interface InstallmentRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  installmentTotal: number | null;
  installmentCurrent: number | null;
  installmentRemaining: number | null;
}

function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return String(cell.v);
  return "";
}

function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === "" || amountStr.trim() === "-") return 0;
  const cleaned = amountStr.replace(/,/g, "").trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parseKoreanDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseInstallmentCell(cell: XLSX.CellObject | undefined): {
  total: number | null;
  current: number | null;
} {
  if (!cell) return { total: null, current: null };
  const raw = cell.w !== undefined ? cell.w : cell.v !== undefined ? String(cell.v) : "";
  const trimmed = raw.trim();
  if (!trimmed) return { total: null, current: null };
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return { total: null, current: null };
  const total = parseInt(match[1], 10);
  const current = parseInt(match[2], 10);
  if (total <= 0 || current <= 0) return { total: null, current: null };
  return { total, current };
}

/**
 * 가맹점명에서 금액 부분을 제거하여 정제 (hyundai.ts의 parseMerchantName 간소 버전)
 */
function cleanMerchantName(rawMerchant: string): string {
  const trimmed = rawMerchant.trim();
  // 해외 결제 패턴
  const foreignMatch = trimmed.match(/^(.+?),([A-Z]{3}):(\d+[\d,.]*\d)$/);
  if (foreignMatch) return foreignMatch[1].trim();
  // 일반: 뒤에서 숫자+쉼표 패턴 제거
  const cleaned = trimmed.replace(/[-]?[\d,]+\.?\d*$/, "").trim();
  return cleaned || trimmed;
}

function extractInstallmentRows(filePath: string): InstallmentRow[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    codepage: 949,
    cellStyles: true,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) return [];

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const rows: InstallmentRow[] = [];

  for (let rowIdx = 3; rowIdx <= range.e.r; rowIdx++) {
    const dateCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })];
    const merchantCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
    const installmentCell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 3 })];
    const col6Cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 6 })];
    const col7Cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 7 })];
    const col8Cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 8 })];

    const dateStr = cellToString(dateCell);
    if (!dateStr.trim() || dateStr.trim().startsWith("-")) continue;

    const parsedDate = parseKoreanDate(dateStr);
    if (!parsedDate) continue;

    const col6Val = parseAmount(cellToString(col6Cell));
    const col7Val = parseAmount(cellToString(col7Cell));
    const amount = col6Val !== 0 ? col6Val : col7Val;
    if (amount === 0) continue;

    const remainingCell = col6Val !== 0 ? col7Cell : col8Cell;
    const remainingVal = parseAmount(cellToString(remainingCell));

    const installment = parseInstallmentCell(installmentCell);

    // 할부 정보가 없으면 스킵 (일시불은 업데이트 불필요)
    if (installment.total === null) continue;

    const merchantName = cleanMerchantName(cellToString(merchantCell));

    rows.push({
      date: parsedDate,
      description: merchantName,
      amount,
      installmentTotal: installment.total,
      installmentCurrent: installment.current,
      installmentRemaining: remainingVal !== 0 ? remainingVal : null,
    });
  }

  return rows;
}

async function main() {
  const dataDir = path.resolve(__dirname, "..", "data");

  if (!fs.existsSync(dataDir)) {
    console.log("data/ 폴더가 없습니다.");
    return;
  }

  const files = fs.readdirSync(dataDir).filter(
    (f) => f.endsWith(".xls") || f.endsWith(".xlsx")
  );

  if (files.length === 0) {
    console.log("data/ 폴더에 엑셀 파일이 없습니다.");
    return;
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    console.log(`\n처리 중: ${file}`);

    const installmentRows = extractInstallmentRows(filePath);
    console.log(`  할부 거래 ${installmentRows.length}건 발견`);

    for (const row of installmentRows) {
      // DB에서 매칭되는 거래 찾기 (날짜 + 금액 + 설명)
      const matches = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.date, row.date),
            eq(schema.transactions.amount, row.amount),
            eq(schema.transactions.description, row.description)
          )
        );

      if (matches.length === 0) {
        totalSkipped++;
        continue;
      }

      for (const match of matches) {
        await db
          .update(schema.transactions)
          .set({
            installmentTotal: row.installmentTotal,
            installmentCurrent: row.installmentCurrent,
            installmentRemaining: row.installmentRemaining,
          })
          .where(eq(schema.transactions.id, match.id));
        totalUpdated++;
      }
    }
  }

  console.log(`\n완료: ${totalUpdated}건 업데이트, ${totalSkipped}건 매칭 실패`);
}

main().catch(console.error);
