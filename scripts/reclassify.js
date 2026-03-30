const { createClient } = require("@libsql/client");
const crypto = require("crypto");
const db = createClient({ url: "file:local.db" });

async function run() {
  const newRules = [
    // 외식
    { pattern: "착한낙지", category: "외식", priority: 80 },
    { pattern: "복호두", category: "외식", priority: 80 },
    { pattern: "퀜넬", category: "외식", priority: 80 },
    { pattern: "유키노카츠", category: "외식", priority: 80 },
    { pattern: "짜장면", category: "외식", priority: 80 },
    { pattern: "야키토리", category: "외식", priority: 80 },
    { pattern: "멘타로", category: "외식", priority: 80 },
    { pattern: "칼국수", category: "외식", priority: 80 },
    { pattern: "감자탕", category: "외식", priority: 80 },
    { pattern: "쭈꾸미", category: "외식", priority: 80 },
    { pattern: "정일품", category: "외식", priority: 70 },
    { pattern: "아비꼬", category: "외식", priority: 80 },
    { pattern: "비빔밥", category: "외식", priority: 80 },
    { pattern: "본죽", category: "외식", priority: 80 },
    { pattern: "에프앤비", category: "외식", priority: 70 },
    { pattern: "세종에프앤디", category: "외식", priority: 70 },
    { pattern: "호두과자", category: "외식", priority: 70 },
    { pattern: "정정숙", category: "외식", priority: 60 },
    { pattern: "엔젤리너스", category: "외식", priority: 80 },
    { pattern: "휴게소", category: "외식", priority: 60 },
    { pattern: "델란", category: "외식", priority: 60 },
    { pattern: "하루하루", category: "외식", priority: 60 },
    { pattern: "정성그룹", category: "외식", priority: 50 },
    // 식료품/마트
    { pattern: "대성축산", category: "식료품/마트", priority: 80 },
    { pattern: "CJ프레시웨이", category: "식료품/마트", priority: 80 },
    { pattern: "농협", category: "식료품/마트", priority: 60 },
    // 육아/완구
    { pattern: "토이스타", category: "육아/완구", priority: 85 },
    { pattern: "노리터", category: "육아/완구", priority: 85 },
    { pattern: "유니크한", category: "육아/완구", priority: 80 },
    { pattern: "핀플레이", category: "육아/완구", priority: 80 },
    { pattern: "키즈룸", category: "육아/완구", priority: 85 },
    { pattern: "꿀잼", category: "육아/완구", priority: 80 },
    { pattern: "마이리틀타이거", category: "육아/완구", priority: 85 },
    { pattern: "사파리사진관", category: "육아/완구", priority: 75 },
    // 패션/뷰티/쇼핑
    { pattern: "무인양품", category: "쇼핑", priority: 80 },
    { pattern: "러쉬", category: "패션/뷰티", priority: 80 },
    { pattern: "SOUP", category: "패션/뷰티", priority: 70 },
    { pattern: "이랜드월드", category: "패션/뷰티", priority: 70 },
    { pattern: "구시맨", category: "패션/뷰티", priority: 70 },
    { pattern: "화이트리에", category: "패션/뷰티", priority: 70 },
    { pattern: "아트박스", category: "쇼핑", priority: 75 },
    // 여행
    { pattern: "마이리얼트립", category: "여행", priority: 90 },
    { pattern: "인천공항", category: "여행", priority: 80 },
    { pattern: "동서로", category: "여행", priority: 60 },
    { pattern: "동은성", category: "여행", priority: 50 },
    // 문화/여가
    { pattern: "시네마", category: "문화/여가", priority: 85 },
    { pattern: "메가박스", category: "문화/여가", priority: 85 },
    { pattern: "볼링", category: "문화/여가", priority: 80 },
    { pattern: "사우나", category: "문화/여가", priority: 70 },
    { pattern: "불가마", category: "문화/여가", priority: 70 },
    { pattern: "박물", category: "문화/여가", priority: 70 },
    { pattern: "포토이즘", category: "문화/여가", priority: 70 },
    { pattern: "슈퍼포토", category: "문화/여가", priority: 70 },
    { pattern: "이대로팩토리", category: "문화/여가", priority: 60 },
    // 보험
    { pattern: "손해보험", category: "보험", priority: 90 },
    { pattern: "DB손해", category: "보험", priority: 90 },
    // 교통/도로
    { pattern: "대전천변", category: "고속도로", priority: 85 },
    { pattern: "인천대교", category: "고속도로", priority: 85 },
    { pattern: "철도승차권", category: "교통", priority: 90 },
    // 구독
    { pattern: "OPENAI", category: "구독", priority: 90 },
    { pattern: "CHATGPT", category: "구독", priority: 90 },
    // 쇼핑 (온라인)
    { pattern: "에스와이폴라리스", category: "쇼핑", priority: 60 },
    { pattern: "엔에스쇼핑", category: "쇼핑", priority: 70 },
    { pattern: "유엔젤", category: "쇼핑", priority: 50 },
    { pattern: "케이케이라이프", category: "쇼핑", priority: 50 },
    { pattern: "윕스퀘어", category: "쇼핑", priority: 50 },
    // 생활
    { pattern: "우정사업본부", category: "생활", priority: 60 },
    { pattern: "전자수입인지", category: "생활", priority: 60 },
    { pattern: "자판기", category: "생활", priority: 40 },
    // 카페/음료
    { pattern: "그린브리즈", category: "식비", priority: 60 },
    { pattern: "99씨", category: "식비", priority: 60 },
    { pattern: "떠그보그", category: "식비", priority: 50 },
    { pattern: "아임일리터", category: "식비", priority: 60 },
  ];

  let inserted = 0;
  for (const rule of newRules) {
    const existing = await db.execute({ sql: "SELECT id FROM category_rules WHERE pattern = ?", args: [rule.pattern] });
    if (existing.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO category_rules (id, pattern, category, priority, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [crypto.randomUUID(), rule.pattern, rule.category, rule.priority, new Date().toISOString()]
      });
      inserted++;
    }
  }
  console.log("새 규칙 추가:", inserted + "개");

  // 전체 재분류
  const rules = await db.execute("SELECT pattern, category, priority FROM category_rules ORDER BY priority DESC");
  const txns = await db.execute("SELECT id, description, category FROM transactions");
  let updated = 0;
  for (const tx of txns.rows) {
    const desc = String(tx.description).toLowerCase();
    let matched = "기타";
    for (const rule of rules.rows) {
      if (desc.includes(String(rule.pattern).toLowerCase())) {
        matched = String(rule.category);
        break;
      }
    }
    if (matched !== String(tx.category)) {
      await db.execute({ sql: "UPDATE transactions SET category = ? WHERE id = ?", args: [matched, tx.id] });
      updated++;
    }
  }
  console.log("재분류:", updated + "건");

  // 기타 남은 것
  const remaining = await db.execute("SELECT description, SUM(amount) as total FROM transactions WHERE category = '기타' GROUP BY description ORDER BY total DESC");
  console.log("\n=== 아직 기타 (" + remaining.rows.length + "개) ===");
  let totalGita = 0;
  for (const row of remaining.rows) {
    totalGita += Number(row.total);
    console.log(Number(row.total).toLocaleString("ko-KR").padStart(10) + "원 | " + row.description);
  }
  console.log("기타 총액:", totalGita.toLocaleString("ko-KR") + "원");

  // 전체 요약
  const summary = await db.execute("SELECT category, COUNT(*) as cnt, SUM(amount) as total FROM transactions GROUP BY category ORDER BY total DESC");
  console.log("\n=== 카테고리별 요약 ===");
  for (const row of summary.rows) {
    console.log(Number(row.total).toLocaleString("ko-KR").padStart(12) + "원 | " + String(row.cnt).padStart(3) + "건 | " + row.category);
  }
}
run();
