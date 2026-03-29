# Smart Ledger — 구현 계획

> 디자인 문서: `~/.gstack/projects/smart-ledger/khkkh-unknown-design-20260328-010238.md` (APPROVED)

## 현대카드 엑셀 구조 (실제 파일 분석 완료)

```
Row 1: "2026년 03월 이용대금명세서"
Row 2: "결제 상세내역"
Row 3: 이용일, 이용카드, 이용가맹점, 이용금액, 할부/회차, 적립/할인율(%), 예상적립/할인, 결제원금, 결제후잔액, 수수료(이자)
Row 4+: 데이터 행
```

**파싱 핵심 주의사항:**
- 컬럼3 `이용가맹점`에 가맹점명+금액이 **붙어있음** (예: `스타벅스코리아4,700`)
- 실제 결제 금액은 컬럼8 `결제원금`을 사용 (쉼표 포함 문자열: `"4,700"`)
- `이용카드` 컬럼에 `본인`/`가족` 구분 포함 → 가족 구성원별 분석 가능
- 소계/합계 행은 `이용일`이 `-`로 시작 → 필터링 필요
- 해외 결제 포함 (JPY 등, 원화 환산 금액은 `결제원금`에 있음)
- 날짜 형식: `2026년 02월 04일` (한국어)
- 파일 3개: 1월/2월/3월 명세서, 각 ~120건

---

## Task 1: 프로젝트 셋업 + Git 초기화
- [ ] `npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint`
- [ ] Git 초기화: `git init && git add . && git commit -m "init: Next.js 15 project"`
- [ ] supanova-design-skill 설치: `.claude/skills/` 에 클론
- [ ] 기존 엑셀/PDF 파일을 `data/` 폴더로 이동 (.gitignore에 추가)
- [ ] CLAUDE.md 작성 (프로젝트 컨벤션)
- [ ] 패키지 설치: `npm install xlsx recharts drizzle-orm @libsql/client bcryptjs jsonwebtoken`
- [ ] 개발 패키지: `npm install -D drizzle-kit @types/bcryptjs @types/jsonwebtoken`

## Task 2: DB 스키마 + Turso 셋업
- [ ] Turso 계정 생성 + DB 생성: `turso db create smart-ledger`
- [ ] 환경변수 설정: `.env.local`에 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `LEDGER_PASSWORD_HASH`
- [ ] Drizzle 스키마 작성: `src/db/schema.ts`
  ```
  transactions: id, date, description, amount(Int), category, cardCompany,
                cardName, memberType(본인/가족), originalCategory, customCategory,
                month, year, statementFile
  incomes: id, date, source, amount, description, month, year
  savings: id, name, monthlyAmount, startDate, endDate
  categoryRules: id, pattern, category, priority
  ```
- [ ] DB 클라이언트: `src/db/index.ts` (Drizzle + libSQL 연결)
- [ ] `drizzle.config.ts` 작성
- [ ] 마이그레이션 실행: `npx drizzle-kit push`
- [ ] 기본 카테고리 규칙 시드 데이터 삽입

## Task 3: 공유 비밀번호 인증
- [ ] `src/middleware.ts`: 쿠키 확인 → 없으면 `/login`으로 리다이렉트
- [ ] `src/app/login/page.tsx`: 비밀번호 입력 폼
- [ ] `src/app/api/auth/route.ts`: bcrypt 비교 → HMAC 서명 토큰 → 쿠키 설정 (7일)
- [ ] `.env.local`에 `LEDGER_PASSWORD_HASH` (bcrypt 해시), `AUTH_SECRET` (HMAC 키)

## Task 4: 현대카드 엑셀 파서
- [ ] `src/lib/parsers/hyundai.ts`: 핵심 파서
  - SheetJS로 .xls 읽기 (`codepage: 949` 옵션)
  - Row 1-2 스킵 (헤더)
  - Row 3 = 컬럼명 확인 (형식 변경 감지)
  - Row 4+: 데이터 파싱
    - `이용일`이 `-`면 스킵 (소계/합계 행)
    - 날짜 파싱: `2026년 02월 04일` → Date
    - `이용카드`에서 `본인`/`가족` 추출 + 카드명 추출
    - `결제원금` 파싱: `"4,700"` → 4700 (쉼표 제거, Int 변환)
    - `결제원금`이 0이면 스킵 (할부 예정 항목 등)
    - `이용가맹점`에서 가맹점명 추출 (숫자+쉼표 패턴 제거)
  - 해외 결제 처리: `JPY:2800.00` 패턴 감지, 가맹점명에서 분리
  - 환불 처리: 음수 금액 유지
- [ ] `src/lib/parsers/categorizer.ts`: 카테고리 자동 분류
  - DB에서 CategoryRule 조회 (priority 내림차순)
  - 가맹점명에 pattern 포함 여부 확인 (대소문자 무시)
  - 매칭 안 되면 `기타`
- [ ] `src/lib/parsers/duplicate-detector.ts`: 중복 감지
  - 같은 날짜+금액+가맹점명 → 후보 목록 반환 (자동 삭제 아님)
- [ ] 파서 단위 테스트 (실제 엑셀 데이터 기반)

## Task 5: 업로드 API + 페이지
- [ ] `src/app/api/upload/route.ts`: 파일 업로드 API
  - multipart/form-data로 .xls 파일 수신
  - 파서 호출 → 파싱 결과 + 중복 후보 반환 (아직 DB 저장 안 함)
- [ ] `src/app/api/transactions/route.ts`: 거래 CRUD API
  - POST: 파싱 결과 확인 후 DB 저장 (중복 제외 선택 포함)
  - GET: 월/년/카테고리/카드사 필터링
  - DELETE: 특정 거래 삭제
- [ ] `src/app/upload/page.tsx`: 업로드 UI
  - 드래그앤드롭 영역 (supanova 스타일)
  - 파싱 결과 미리보기 테이블
  - 중복 후보 경고 + 체크박스로 제외 선택
  - "저장" 버튼으로 확정

## Task 6: 대시보드
- [ ] `src/app/page.tsx`: 메인 대시보드
  - 이번 달 총 지출 카드 (supanova 더블 베젤)
  - 카테고리별 파이차트 (Recharts PieChart)
  - 카테고리별 바차트 (Recharts BarChart)
  - 지난달 대비 증감률 (화살표 + 퍼센트)
  - 수입 대비 지출 비율 게이지
  - 저축률 표시
  - 본인/가족 지출 비교
- [ ] `src/app/api/dashboard/route.ts`: 대시보드 데이터 API
  - 월별 카테고리 합산
  - 전월 대비 증감 계산
  - 수입/저축 데이터 조회

## Task 7: 지출 상세 페이지
- [ ] `src/app/expenses/page.tsx`:
  - 전체 거래 목록 테이블 (날짜, 가맹점, 금액, 카테고리, 본인/가족)
  - 필터: 기간 선택, 카테고리, 카드사, 본인/가족
  - 검색: 가맹점명 텍스트 검색
  - 카테고리 수정 (클릭 → 드롭다운)
  - 페이지네이션 또는 무한 스크롤

## Task 8: 수입/저축 관리
- [ ] `src/app/income/page.tsx`:
  - 월급/보너스 입력 폼 (금액, 날짜, 유형)
  - 수입 목록 (월별)
  - 적금 목록 + 추가/편집
  - 저축률 추이 차트 (Recharts LineChart)
- [ ] `src/app/api/income/route.ts`: 수입 CRUD
- [ ] `src/app/api/savings/route.ts`: 적금 CRUD

## Task 9: 분석 페이지
- [ ] `src/app/analytics/page.tsx`:
  - 월별 지출 비교 차트 (1월 vs 2월 vs 3월)
  - 카테고리별 트렌드 (월별 변화)
  - TOP 5 지출처 랭킹
  - 규칙 기반 인사이트 카드:
    - "이번 달 식비가 지난달 대비 X% 증가"
    - "외식비를 10% 줄이면 월 X원 절약"
  - 본인 vs 가족 지출 비교
- [ ] `src/lib/analytics/insights.ts`: 인사이트 생성 로직
  - 전월 대비 카테고리별 증감 계산
  - TOP N 지출처 추출
  - 절약 시뮬레이션

## Task 10: 레이아웃 + 네비게이션 + supanova 디자인
- [ ] `src/app/layout.tsx`: 글로벌 레이아웃
  - supanova 글래스 네비게이션 바
  - 사이드바 또는 탑 네비게이션 (대시보드/지출/분석/수입/업로드)
  - 한국어 타이포그래피 (Pretendard 또는 Noto Sans KR)
  - 다크모드 지원
- [ ] 공통 컴포넌트:
  - `src/components/ui/Card.tsx` (더블 베젤 카드)
  - `src/components/ui/Button.tsx`
  - `src/components/ui/Input.tsx`
  - `src/components/charts/PieChart.tsx`
  - `src/components/charts/BarChart.tsx`
  - `src/components/charts/LineChart.tsx`
  - `src/components/layout/Navigation.tsx`

## Task 11: 배포
- [ ] GitHub 리포지토리 생성
- [ ] Vercel 연동 + 환경변수 설정 (TURSO_*, LEDGER_PASSWORD_HASH, AUTH_SECRET)
- [ ] 첫 배포 확인
- [ ] 1~3월 엑셀 파일 업로드 → 실제 데이터로 테스트

---

## 구현 순서 (의존성 기반)

```
Task 1 (셋업) → Task 2 (DB) → Task 3 (인증) → Task 4 (파서)
                                                    ↓
Task 10 (디자인/레이아웃) ──────────────→ Task 5 (업로드)
                                                    ↓
                                          Task 6 (대시보드)
                                                    ↓
                                    Task 7 (지출상세) + Task 8 (수입/저축)
                                                    ↓
                                          Task 9 (분석)
                                                    ↓
                                          Task 11 (배포)
```

**병렬 가능:** Task 10(디자인)은 Task 2-4와 동시에 작업 가능

## 예상 소요 시간 (CC+gstack)

| Task | 예상 |
|------|------|
| Task 1-2: 셋업+DB | ~15분 |
| Task 3: 인증 | ~10분 |
| Task 4: 파서 | ~20분 |
| Task 5: 업로드 | ~15분 |
| Task 6: 대시보드 | ~20분 |
| Task 7: 지출상세 | ~15분 |
| Task 8: 수입/저축 | ~15분 |
| Task 9: 분석 | ~15분 |
| Task 10: 디자인 | ~20분 |
| Task 11: 배포 | ~10분 |
| **Total** | **~2.5시간** |
