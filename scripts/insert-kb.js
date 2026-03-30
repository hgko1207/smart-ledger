const { createClient } = require("@libsql/client");
const XLSX = require("xlsx");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = createClient({ url: "file:local.db" });

// 국민카드 날짜 파싱: "25.12.03" → "2025-12-03"
function parseKBDate(dateStr) {
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  return `20${match[1]}-${match[2]}-${match[3]}`;
}

// 셀 값을 문자열로
function cellStr(cell) {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return String(cell.v);
  return "";
}

// 셀 값을 숫자로
function cellNum(cell) {
  if (!cell) return 0;
  if (cell.v !== undefined && typeof cell.v === "number") return cell.v;
  const str = cellStr(cell).replace(/,/g, "").trim();
  if (!str) return 0;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// 파일명에서 년/월 추출
function parseStatementFromFileName(fileName) {
  const match = fileName.match(/(\d{4})(\d{2})/);
  if (!match) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

// 스킵 행 확인
function shouldSkipRow(cells) {
  const rowText = cells.map(c => cellStr(c)).join(" ");
  if (rowText.includes("본인회원 소 계")) return true;
  if (rowText.includes("합 계")) return true;
  if (rowText.includes("무이자혜택금액")) return true;
  return false;
}

// 카테고리 분류
async function categorize(merchantName, rules) {
  const lowerName = merchantName.toLowerCase();
  for (const rule of rules) {
    if (lowerName.includes(String(rule.pattern).toLowerCase())) {
      return String(rule.category);
    }
  }
  return "기타";
}

// 중복 체크 키 생성
function makeKey(date, amount, description) {
  const normalizedDesc = description.replace(/\s+/g, "").toLowerCase();
  return `${date}|${amount}|${normalizedDesc}`;
}

async function parseAndInsertFile(filePath, rules) {
  const fileName = path.basename(filePath);
  const { year: statementYear, month: statementMonth } = parseStatementFromFileName(fileName);

  console.log(`\n=== ${fileName} (${statementYear}년 ${statementMonth}월) ===`);

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer", codepage: 949, cellStyles: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    console.log("시트가 없습니다. 스킵.");
    return { inserted: 0, duplicates: 0, skipped: 0 };
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const startCol = range.s.c; // 실제 시작 컬럼 (국민카드는 B열=1부터 시작)

  // 기존 거래 로드 (중복 체크용)
  const existing = await db.execute({
    sql: "SELECT date, amount, description FROM transactions WHERE year = ? AND month = ?",
    args: [statementYear, statementMonth]
  });
  const existingKeys = new Set();
  for (const row of existing.rows) {
    existingKeys.add(makeKey(String(row.date), Number(row.amount), String(row.description)));
  }

  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;

  const dataStartRow = range.s.r + 2; // 헤더 2행 건너뛰기
  for (let rowIdx = dataStartRow; rowIdx <= range.e.r; rowIdx++) {
    const cells = [];
    for (let colIdx = 0; colIdx <= 12; colIdx++) {
      cells.push(sheet[XLSX.utils.encode_cell({ r: rowIdx, c: startCol + colIdx })]);
    }

    // 스킵 조건
    if (shouldSkipRow(cells)) { skipped++; continue; }

    const dateStr = cellStr(cells[0]);
    if (!dateStr.trim()) { skipped++; continue; }

    const parsedDate = parseKBDate(dateStr);
    if (!parsedDate) { skipped++; continue; }

    const principal = cellNum(cells[8]);
    if (principal === 0) { skipped++; continue; }

    const merchantName = cellStr(cells[3]).trim();
    if (!merchantName) { skipped++; continue; }

    const cardName = cellStr(cells[1]).trim() || "국민카드";
    const installmentMonths = cellNum(cells[6]);
    const currentInstallment = cellNum(cells[7]);
    const remainingBalance = cellNum(cells[11]);

    const [yearStr, monthStr] = parsedDate.split("-");
    const txYear = parseInt(yearStr, 10);
    const txMonth = parseInt(monthStr, 10);

    // 중복 체크
    const key = makeKey(parsedDate, principal, merchantName);
    if (existingKeys.has(key)) {
      duplicates++;
      continue;
    }

    // 카테고리 분류
    const category = await categorize(merchantName, rules);

    // DB 삽입
    await db.execute({
      sql: `INSERT INTO transactions (id, date, description, amount, category, card_company, card_name, member_type, month, year, statement_file, installment_total, installment_current, installment_remaining, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        parsedDate,
        merchantName,
        principal,
        category,
        "kb",
        cardName,
        "본인",
        txMonth,
        txYear,
        fileName,
        installmentMonths > 0 ? installmentMonths : null,
        currentInstallment > 0 ? currentInstallment : null,
        remainingBalance > 0 ? remainingBalance : null,
        new Date().toISOString()
      ]
    });

    // 중복 방지를 위해 키 추가
    existingKeys.add(key);
    inserted++;
  }

  console.log(`  삽입: ${inserted}건, 중복: ${duplicates}건, 스킵: ${skipped}건`);
  return { inserted, duplicates, skipped };
}

async function run() {
  const dataDir = path.join(__dirname, "..", "data");

  // 국민카드 파일 찾기
  const kbFiles = fs.readdirSync(dataDir)
    .filter(f => f.startsWith("국민카드") && (f.endsWith(".xlsx") || f.endsWith(".xls")))
    .sort();

  if (kbFiles.length === 0) {
    console.log("data/ 폴더에 국민카드 파일이 없습니다.");
    return;
  }

  console.log(`국민카드 파일 ${kbFiles.length}개 발견:`, kbFiles);

  // 카테고리 규칙 로드
  const rulesResult = await db.execute("SELECT pattern, category, priority FROM category_rules ORDER BY priority DESC");
  const rules = rulesResult.rows;
  console.log(`카테고리 규칙 ${rules.length}개 로드`);

  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;

  for (const file of kbFiles) {
    const result = await parseAndInsertFile(path.join(dataDir, file), rules);
    totalInserted += result.inserted;
    totalDuplicates += result.duplicates;
    totalSkipped += result.skipped;
  }

  console.log(`\n=== 전체 결과 ===`);
  console.log(`총 삽입: ${totalInserted}건`);
  console.log(`총 중복: ${totalDuplicates}건`);
  console.log(`총 스킵: ${totalSkipped}건`);

  // 국민카드 거래 요약
  const summary = await db.execute(
    "SELECT category, COUNT(*) as cnt, SUM(amount) as total FROM transactions WHERE card_company = 'kb' GROUP BY category ORDER BY total DESC"
  );
  console.log(`\n=== 국민카드 카테고리별 요약 ===`);
  for (const row of summary.rows) {
    console.log(
      Number(row.total).toLocaleString("ko-KR").padStart(12) + "원 | " +
      String(row.cnt).padStart(3) + "건 | " + row.category
    );
  }
}

run().catch(console.error);
