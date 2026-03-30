const fs = require("fs");
const XLSX = require("xlsx");
const { createClient } = require("@libsql/client");
const db = createClient({ url: "file:local.db" });

// Excel serial number → 할부 total/current 역변환
// SheetJS가 "3/3"을 날짜로 해석하면 serial number가 됨
// serial → Date → month=total, day=current
function serialToInstallment(serial) {
  if (typeof serial !== "number" || serial < 1) return null;
  // Excel serial date to JS date (Excel 1900 date system)
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(excelEpoch.getTime() + serial * 86400000);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  // 할부는 보통 2~36개월, 회차는 1~36
  if (month >= 1 && month <= 36 && day >= 1 && day <= 36 && day <= month) {
    return { total: month, current: day };
  }
  return null;
}

async function run() {
  const files = fs.readdirSync("data").filter(f => f.endsWith(".xls"));
  let totalUpdated = 0;
  let checked = 0;

  for (const file of files) {
    console.log("Processing:", file);
    const wb = XLSX.read(fs.readFileSync("data/" + file), { codepage: 949, cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let r = 3; r <= range.e.r; r++) {
      const dateCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!dateCell) continue;
      const dateStr = dateCell.w || String(dateCell.v || "");
      if (!dateStr.trim() || dateStr.trim().startsWith("-")) continue;

      const dateMatch = dateStr.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (!dateMatch) continue;
      const date = dateMatch[1] + "-" + dateMatch[2].padStart(2, "0") + "-" + dateMatch[3].padStart(2, "0");

      // 할부 정보 (col[3])
      const instCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      if (!instCell) continue;

      let installment = null;

      // 먼저 .w (formatted text)에서 "N/M" 패턴 시도
      if (instCell.w) {
        const m = instCell.w.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
        if (m) installment = { total: parseInt(m[1]), current: parseInt(m[2]) };
      }

      // .w가 비어있거나 매칭 안 되면 숫자값에서 역변환
      if (!installment && typeof instCell.v === "number") {
        installment = serialToInstallment(instCell.v);
      }

      if (!installment) continue;
      checked++;

      // 결제원금 (col[6])
      const c6 = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      const c6str = c6 ? (c6.w || String(c6.v || "")) : "";
      const amount = parseInt(c6str.replace(/,/g, ""), 10) || 0;
      if (amount === 0) continue;

      // 잔액 (col[7])
      const c7 = ws[XLSX.utils.encode_cell({ r, c: 7 })];
      const c7str = c7 ? (c7.w || String(c7.v || "")) : "";
      const remaining = parseInt(c7str.replace(/,/g, ""), 10) || 0;

      // DB 매칭: date + amount
      const matches = await db.execute({
        sql: "SELECT id, installment_total FROM transactions WHERE date = ? AND amount = ?",
        args: [date, amount]
      });

      for (const row of matches.rows) {
        if (row.installment_total !== null) continue; // 이미 있으면 스킵
        await db.execute({
          sql: "UPDATE transactions SET installment_total = ?, installment_current = ?, installment_remaining = ? WHERE id = ?",
          args: [installment.total, installment.current, remaining > 0 ? remaining : null, row.id]
        });
        totalUpdated++;
        break; // 첫 매칭만
      }
    }
  }

  console.log("\nChecked installment rows:", checked);
  console.log("Updated:", totalUpdated, "transactions");

  // 결과 확인
  const active = await db.execute("SELECT description, installment_total, installment_current, installment_remaining, amount FROM transactions WHERE installment_total IS NOT NULL AND installment_current < installment_total ORDER BY installment_remaining DESC NULLS LAST");
  console.log("\n=== 진행 중 할부 (" + active.rows.length + "건) ===");
  for (const row of active.rows) {
    const rem = row.installment_remaining ? Number(row.installment_remaining).toLocaleString("ko-KR") + "원" : "-";
    const left = row.installment_total - row.installment_current;
    console.log(row.installment_current + "/" + row.installment_total + " (남은 " + left + "개월) | " + Number(row.amount).toLocaleString("ko-KR") + "원/월 | 잔액: " + rem + " | " + row.description);
  }

  const completed = await db.execute("SELECT COUNT(*) as cnt FROM transactions WHERE installment_total IS NOT NULL AND installment_current >= installment_total");
  console.log("\n완료된 할부:", completed.rows[0].cnt + "건");
}

run();
