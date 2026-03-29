import { db } from "./index";
import { categoryRules } from "./schema";

// 기본 카테고리 규칙 시드 데이터
// 한국 가맹점 키워드 기반 자동 분류 규칙
const seedRules = [
  // 식비 - 음식점, 카페, 배달
  { pattern: "스타벅스", category: "식비", priority: 100 },
  { pattern: "맥도날드", category: "식비", priority: 100 },
  { pattern: "버거킹", category: "식비", priority: 100 },
  { pattern: "롯데리아", category: "식비", priority: 100 },
  { pattern: "배달의민족", category: "식비", priority: 100 },
  { pattern: "배민", category: "식비", priority: 90 },
  { pattern: "요기요", category: "식비", priority: 100 },
  { pattern: "쿠팡이츠", category: "식비", priority: 100 },
  { pattern: "교촌", category: "식비", priority: 100 },
  { pattern: "BBQ", category: "식비", priority: 100 },
  { pattern: "BHC", category: "식비", priority: 100 },
  { pattern: "피자", category: "식비", priority: 80 },
  { pattern: "치킨", category: "식비", priority: 80 },
  { pattern: "카페", category: "식비", priority: 80 },
  { pattern: "커피", category: "식비", priority: 80 },
  { pattern: "베이커리", category: "식비", priority: 80 },
  { pattern: "빵집", category: "식비", priority: 80 },
  { pattern: "파리바게뜨", category: "식비", priority: 100 },
  { pattern: "뚜레쥬르", category: "식비", priority: 100 },
  { pattern: "이디야", category: "식비", priority: 100 },
  { pattern: "투썸", category: "식비", priority: 100 },
  { pattern: "메가커피", category: "식비", priority: 100 },
  { pattern: "컴포즈", category: "식비", priority: 100 },
  { pattern: "식당", category: "식비", priority: 70 },
  { pattern: "김밥", category: "식비", priority: 80 },
  { pattern: "분식", category: "식비", priority: 80 },
  { pattern: "CU", category: "식비", priority: 90 },
  { pattern: "GS25", category: "식비", priority: 90 },
  { pattern: "세븐일레븐", category: "식비", priority: 90 },
  { pattern: "이마트24", category: "식비", priority: 90 },
  { pattern: "편의점", category: "식비", priority: 80 },
  { pattern: "마트", category: "식비", priority: 70 },
  { pattern: "이마트", category: "식비", priority: 90 },
  { pattern: "홈플러스", category: "식비", priority: 90 },
  { pattern: "코스트코", category: "식비", priority: 90 },
  { pattern: "하나로마트", category: "식비", priority: 90 },
  { pattern: "반찬", category: "식비", priority: 80 },

  // 교통 - 대중교통, 택시, 주유
  { pattern: "택시", category: "교통", priority: 100 },
  { pattern: "카카오T", category: "교통", priority: 100 },
  { pattern: "타다", category: "교통", priority: 100 },
  { pattern: "주유소", category: "교통", priority: 100 },
  { pattern: "SK에너지", category: "교통", priority: 100 },
  { pattern: "GS칼텍스", category: "교통", priority: 100 },
  { pattern: "현대오일뱅크", category: "교통", priority: 100 },
  { pattern: "S-OIL", category: "교통", priority: 100 },
  { pattern: "주차", category: "교통", priority: 90 },
  { pattern: "하이패스", category: "교통", priority: 100 },
  { pattern: "톨게이트", category: "교통", priority: 100 },
  { pattern: "코레일", category: "교통", priority: 100 },
  { pattern: "KTX", category: "교통", priority: 100 },
  { pattern: "SRT", category: "교통", priority: 100 },
  { pattern: "고속버스", category: "교통", priority: 100 },

  // 쇼핑 - 온라인/오프라인 쇼핑
  { pattern: "쿠팡", category: "쇼핑", priority: 90 },
  { pattern: "네이버페이", category: "쇼핑", priority: 80 },
  { pattern: "카카오페이", category: "쇼핑", priority: 80 },
  { pattern: "토스페이먼츠", category: "쇼핑", priority: 70 },
  { pattern: "11번가", category: "쇼핑", priority: 100 },
  { pattern: "G마켓", category: "쇼핑", priority: 100 },
  { pattern: "옥션", category: "쇼핑", priority: 100 },
  { pattern: "위메프", category: "쇼핑", priority: 100 },
  { pattern: "티몬", category: "쇼핑", priority: 100 },
  { pattern: "무신사", category: "쇼핑", priority: 100 },
  { pattern: "올리브영", category: "쇼핑", priority: 100 },
  { pattern: "다이소", category: "쇼핑", priority: 100 },
  { pattern: "아마존", category: "쇼핑", priority: 100 },
  { pattern: "AMAZON", category: "쇼핑", priority: 100 },
  { pattern: "백화점", category: "쇼핑", priority: 80 },
  { pattern: "아울렛", category: "쇼핑", priority: 80 },

  // 구독 - 정기결제, OTT, 서비스
  { pattern: "넷플릭스", category: "구독", priority: 100 },
  { pattern: "NETFLIX", category: "구독", priority: 100 },
  { pattern: "유튜브", category: "구독", priority: 100 },
  { pattern: "YOUTUBE", category: "구독", priority: 100 },
  { pattern: "GOOGLE", category: "구독", priority: 80 },
  { pattern: "APPLE", category: "구독", priority: 80 },
  { pattern: "디즈니", category: "구독", priority: 100 },
  { pattern: "왓챠", category: "구독", priority: 100 },
  { pattern: "웨이브", category: "구독", priority: 100 },
  { pattern: "티빙", category: "구독", priority: 100 },
  { pattern: "스포티파이", category: "구독", priority: 100 },
  { pattern: "SPOTIFY", category: "구독", priority: 100 },
  { pattern: "멜론", category: "구독", priority: 100 },
  { pattern: "지니뮤직", category: "구독", priority: 100 },

  // 의료 - 병원, 약국
  { pattern: "병원", category: "의료", priority: 100 },
  { pattern: "의원", category: "의료", priority: 100 },
  { pattern: "약국", category: "의료", priority: 100 },
  { pattern: "치과", category: "의료", priority: 100 },
  { pattern: "안과", category: "의료", priority: 100 },
  { pattern: "피부과", category: "의료", priority: 100 },
  { pattern: "한의원", category: "의료", priority: 100 },
  { pattern: "클리닉", category: "의료", priority: 90 },
  { pattern: "메디", category: "의료", priority: 70 },

  // 교육 - 학원, 교재, 강의
  { pattern: "학원", category: "교육", priority: 100 },
  { pattern: "교육", category: "교육", priority: 80 },
  { pattern: "인프런", category: "교육", priority: 100 },
  { pattern: "클래스101", category: "교육", priority: 100 },
  { pattern: "유데미", category: "교육", priority: 100 },
  { pattern: "UDEMY", category: "교육", priority: 100 },
  { pattern: "서점", category: "교육", priority: 90 },
  { pattern: "교보문고", category: "교육", priority: 100 },
  { pattern: "예스24", category: "교육", priority: 100 },
  { pattern: "알라딘", category: "교육", priority: 100 },

  // 연회비
  { pattern: "연회비", category: "기타", priority: 100 },
];

async function seed() {
  console.log("카테고리 규칙 시드 데이터 삽입 시작...");

  const now = new Date().toISOString();

  for (const rule of seedRules) {
    await db.insert(categoryRules).values({
      id: crypto.randomUUID(),
      pattern: rule.pattern,
      category: rule.category,
      priority: rule.priority,
      createdAt: now,
    });
  }

  console.log(`${seedRules.length}개의 카테고리 규칙이 삽입되었습니다.`);
}

seed().catch(console.error);
