# Smart Ledger — 구현 계획

> 디자인 문서: `~/.gstack/projects/smart-ledger/khkkh-unknown-design-20260328-010238.md` (APPROVED)
> GitHub: https://github.com/hgko1207/smart-ledger

---

## 완료된 작업

### Phase 1: 코어 기능 (Task 1-11)

- [x] **Task 1: 프로젝트 셋업** — Next.js 15 + TypeScript + Tailwind + Git
- [x] **Task 2: DB 스키마** — Drizzle ORM + Turso(libSQL), transactions/incomes/savings/categoryRules 테이블
- [x] **Task 3: 공유 비밀번호 인증** — bcrypt + JWT 쿠키 (7일)
- [x] **Task 4: 현대카드 엑셀 파서** — SheetJS, codepage 949, 가맹점+금액 분리, 본인/가족 구분, 해외결제
- [x] **Task 5: 업로드 페이지** — 드래그앤드롭, 파싱 미리보기, 중복 감지
- [x] **Task 6: 대시보드** — 히어로 총 지출, 도넛 차트 + 범례, 본인/가족 바
- [x] **Task 7: 지출 상세** — 거래 목록 테이블, 필터, 검색, 카테고리 편집
- [x] **Task 8: 수입/저축** — 수입 CRUD, 적금 관리, 저축률
- [x] **Task 9: 분석** — 월별 비교, TOP 5, 인사이트, 카테고리 트렌드
- [x] **Task 10: 레이아웃** — 사이드바 네비게이션, 모바일 탭바
- [x] **Task 11: GitHub 배포** — 리포 생성 + 푸시 완료 (Vercel 배포는 미완)

### Phase 2: 추가 기능

- [x] **국민카드 파서** — KB카드 엑셀(.xlsx) 자동 감지 + 파싱. 20건 데이터 삽입
- [x] **할부 추적** — installmentTotal/Current/Remaining DB 컬럼, /installments 전용 페이지
- [x] **할부 월별 계산** — 구매일 + 할부 기간으로 선택 월 기준 진행 중/완료 자동 계산
- [x] **수입 편집 기능** — 수입/적금 인라인 편집 (PATCH API)
- [x] **수입 카테고리 확장** — salary, bonus, freelance, tax_refund, investment, allowance, other
- [x] **설정 페이지** — 카테고리 규칙 관리 (추가/삭제), 앱 부제 변경
- [x] **카테고리 규칙 125개** — 21개 카테고리 (외식, 배달, 마트, 여행, 육아, 문화 등)

### Phase 3: 디자인 리뉴얼

- [x] **대시보드 토스 스타일** — 히어로 섹션 (text-5xl), 도넛+범례 통합 (바차트/상세리스트 제거)
- [x] **인사이트 카드** — 전월 대비 가장 크게 변한 카테고리 자동 감지
- [x] **지출 상세 리디자인** — 헤더 클릭 정렬, 21개 카테고리 컬러 도트, 모바일 카드뷰
- [x] **분석 리디자인** — TOP 5 트렌드, 본인/가족 가로바, 할부 간결 요약
- [x] **수입/저축 리디자인** — 저축률 프로그레스 바, 카테고리 컬러 뱃지, hover 삭제
- [x] **할부/업로드/설정/로그인 리디자인** — 전체 페이지 스타일 통일
- [x] **접근성** — aria-label 70곳, scope="col", aria-expanded, 필수 필드 표시
- [x] **라이트/다크 테마 토글** — Tailwind dark: 클래스, localStorage, SSR 기본 다크
- [x] **전체 라이트 모드 대응** — 모든 페이지 dark: 프리픽스 적용 (0곳 잔여)
- [x] **네비게이션 리디자인** — 활성 메뉴 bg-blue-600, 하단 테마 토글, 부제 설정

### Phase 4: 고급 기능

- [x] **예산 설정** — budgets 테이블, 설정에서 카테고리별 한도 입력, 대시보드 진행률 표시 (파랑/노랑/빨강 + "초과!" 배지)
- [x] **고정비 자동 감지** — 3개월 연속 같은 가맹점 ±20% → 대시보드 카드 + 분석 테이블
- [x] **기타 지출 페이지** — /manual-expenses, 카드 외 지출 (헌금, 용돈, 대출 등) 수동 입력
  - 10개 카테고리: 헌금/기부, 용돈/지원, 계모임/회비, 주택대출, 차량대출, 가족대출, 기타대출, 현금지출, 계좌이체, 기타
  - 매월 반복(🔄) 플래그, 인라인 편집, CRUD API
  - cardCompany="manual"로 기존 transactions에 저장 → 대시보드/분석 자동 합산
- [x] **사이드바 그룹핑** — "한눈에 보기" / "돈 관리" / "도구" 그룹 + "지출 상세"→"지출 내역" 이름 변경
- [x] **설정 카테고리 규칙 접기** — 125개 규칙 목록 접기/펼기 토글

---

## 현재 상태

### 기술 스택
| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4, dark: 클래스 |
| Charts | Recharts |
| DB | Turso (libSQL) + Drizzle ORM |
| Auth | bcryptjs + jsonwebtoken |
| Excel | SheetJS (xlsx) |
| Deploy | GitHub (Vercel 미완) |

### 페이지 구성 (9개)
| 페이지 | 경로 | 사이드바 그룹 | 상태 |
|--------|------|-------------|------|
| 대시보드 | / | 한눈에 보기 | ✅ 토스 스타일, 예산 진행률, 고정비 |
| 지출 내역 | /expenses | 돈 관리 | ✅ 정렬, 21카테고리, 모바일 카드뷰 |
| 수입/저축 | /income | 돈 관리 | ✅ 편집, 7개 수입 유형, 저축률 바 |
| 기타 지출 | /manual-expenses | 돈 관리 | ✅ 10개 카테고리, 반복 플래그, 대출 관리 |
| 할부 | /installments | 돈 관리 | ✅ 월별 계산, 진행률, 완료 토글 |
| 분석 | /analytics | 도구 | ✅ 인사이트, TOP 5, 트렌드, 고정비 |
| 업로드 | /upload | 도구 | ✅ 드래그앤드롭, 현대/국민카드 자동 감지 |
| 설정 | /settings | 하단 | ✅ 카테고리 규칙(접기), 예산, 부제 변경 |
| 로그인 | /login | — | ✅ 공유 비밀번호 |

### API (13개)
| API | 경로 | 메서드 |
|-----|------|--------|
| 인증 | /api/auth | POST |
| 대시보드 | /api/dashboard | GET |
| 거래 | /api/transactions | GET, POST, PATCH, DELETE |
| 업로드 | /api/upload | POST |
| 수입 | /api/income | GET, POST, PATCH, DELETE |
| 적금 | /api/savings | GET, POST, PATCH, DELETE |
| 기타 지출 | /api/manual-expenses | GET, POST, PATCH, DELETE |
| 분석 | /api/analytics | GET |
| 할부 | /api/installments | GET |
| 예산 | /api/budgets | GET, POST, DELETE |
| 고정비 | /api/fixed-costs | GET |
| 카테고리 설정 | /api/settings/categories | GET, POST, DELETE |

### 파서 (2개)
| 카드사 | 파서 | 상태 |
|--------|------|------|
| 현대카드 | src/lib/parsers/hyundai.ts | ✅ .xls, 할부 포함 |
| 국민카드 | src/lib/parsers/kb.ts | ✅ .xlsx, 자동 감지 |

### DB 테이블 (5개)
| 테이블 | 용도 |
|--------|------|
| transactions | 거래 내역 — 카드(445건) + 수동(manual) 통합. isRecurring 컬럼 |
| incomes | 수입 (7개 유형: 월급, 보너스, 프리랜서, 연말정산, 투자, 용돈, 기타) |
| savings | 적금 |
| categoryRules | 카테고리 자동 분류 규칙 (125개) |
| budgets | 카테고리별 예산 한도 |

---

## 다음 작업 (구현 예정)

### 기능 A: 가용금액 표시 (대시보드)

**목적:** 이번 달 남은 가용금액을 한눈에 파악하여 지출 통제력 향상

**구현 체크리스트:**

- [x] **A-1. 대시보드 페이지에 가용금액 카드 추가**
  - 파일: `src/app/page.tsx`
  - 계산식: `가용금액 = totalIncome - fixedCosts.totalMonthly - (totalExpense - fixedCosts.totalMonthly)`
    - 즉, `가용금액 = totalIncome - totalExpense` (고정비는 이미 totalExpense에 포함)
    - 변동지출 = `totalExpense - fixedCosts.totalMonthly`
    - 소진율 = `변동지출 / (totalIncome - fixedCosts.totalMonthly) * 100`
  - 이미 `data.totalIncome`, `data.totalExpense`, `fixedCosts.totalMonthly` 모두 fetch하고 있으므로 프론트 조합만
  - 카드 위치: 히어로 섹션 아래, 기존 카드들 위 (수입/저축률 카드 근처)
  - UI 요소:
    - "이번 달 가용금액" 라벨 + `formatKRW(available)` 금액 표시
    - 프로그레스 바: 소진율 시각화 (파랑 < 70%, 노랑 70-90%, 빨강 > 90%)
    - 하단 텍스트: "고정지출 {formatKRW} 제외, 변동지출 {formatKRW} 사용 중"
  - `formatKRW` import from `@/lib/format`
  - aria-label="가용금액 현황" 필수

- [x] **A-2. 타입 정의 추가**
  - 파일: `src/app/page.tsx` (기존 인터페이스 영역)
  - 기존 `DashboardData`, `FixedCostsData` 인터페이스 활용 — 새 타입 불필요
  - `useMemo`로 가용금액/소진율 계산값 메모이제이션

---

### 기능 B: 지출 메모

**목적:** 각 거래에 한줄 메모를 남겨 지출 맥락(선물, 경조사 등)을 기록

**구현 체크리스트:**

- [ ] **B-1. DB 스키마에 memo 컬럼 추가**
  - 파일: `src/db/schema.ts`
  - `transactions` 테이블에 `memo: text("memo")` 추가 (nullable)
  - `Transaction`, `NewTransaction` 타입은 `$inferSelect`/`$inferInsert`로 자동 반영
  - 마이그레이션: `npx drizzle-kit push`

- [ ] **B-2. transactions PATCH API에 memo 필드 추가**
  - 파일: `src/app/api/transactions/route.ts`
  - 현재 PATCH는 `{ id, category }` 만 처리
  - body 타입을 `{ id: string; category?: string; memo?: string }` 로 확장
  - category 수정과 memo 수정을 독립적으로 처리 (둘 다 올 수도, 하나만 올 수도)
  - `.set()` 호출 시 undefined가 아닌 필드만 포함

- [ ] **B-3. transactions GET API에 memo 포함 확인**
  - 파일: `src/app/api/transactions/route.ts`
  - 현재 `select()` 호출이 전체 컬럼 반환하는지 확인 → memo 컬럼 자동 포함될 것
  - 응답 타입에 memo 포함 확인

- [ ] **B-4. 지출 내역 페이지에 메모 UI 추가**
  - 파일: `src/app/expenses/page.tsx`
  - 각 거래 행에 메모 아이콘 버튼 (메모 있으면 채워진 아이콘, 없으면 빈 아이콘)
  - 클릭 시 인라인 텍스트 입력 펼침 (input type="text", maxLength=100)
  - Enter 또는 blur 시 PATCH 호출로 저장
  - 모바일 카드뷰에서도 메모 표시/편집 가능
  - aria-label="메모 편집" 필수

- [ ] **B-5. 기타 지출 페이지에도 메모 UI 적용**
  - 파일: `src/app/manual-expenses/page.tsx`
  - expenses 페이지와 동일한 인라인 메모 패턴 적용
  - 기존 인라인 편집 UI 패턴 참고 (이미 수입 편집 구현됨)

- [ ] **B-6. 타입체크 통과 확인**
  - `npx tsc --noEmit` 실행
  - memo가 nullable이므로 `string | null` 처리 주의

---

### 기능 C: 연간 리포트 페이지

**목적:** 12개월 전체 지출/수입/저축 흐름을 한 페이지에서 조망

**구현 체크리스트:**

- [x] **C-1. 연간 리포트 API 생성**
  - 파일: `src/app/api/annual-report/route.ts` (신규)
  - GET `?year=2026`
  - 응답 구조:
    ```
    {
      year: number,
      monthlyData: { month: number, expense: number, income: number, savings: number }[],
      categoryTotals: { category: string, total: number }[],
      totalExpense: number,
      totalIncome: number,
      totalSavings: number,
      avgMonthlyExpense: number,
      topMonth: { month: number, expense: number },
      bottomMonth: { month: number, expense: number }
    }
    ```
  - 쿼리: transactions/incomes/savings 테이블에서 해당 year 전체 집계
  - `cache: "no-store"` 헤더
  - 기존 analytics/route.ts의 getPreviousMonths 패턴 참고

- [x] **C-2. 연간 리포트 페이지 생성**
  - 파일: `src/app/annual-report/page.tsx` (신규)
  - `"use client"` (차트 + 인터랙션)
  - 연도 셀렉터 (기본값: 현재 연도)
  - 섹션 1: 연간 요약 카드 — 총수입, 총지출, 총저축, 월평균 지출
  - 섹션 2: 월별 지출 추이 BarChart (Recharts, 12개월)
    - `CHART_COLORS`, `TOOLTIP_STYLE` import from `@/lib/theme/colors`
    - `formatKRW` import from `@/lib/format`
  - 섹션 3: 카테고리별 연간 합계 PieChart (도넛)
    - 기존 대시보드 도넛 차트 패턴 재사용
  - 섹션 4: 수입 vs 지출 월별 비교 (BarChart, 2색 스택)
  - 가장 많이/적게 쓴 달 하이라이트
  - 로딩: `PageSkeleton` 컴포넌트 사용
  - 다크/라이트 모드 대응 (`dark:` 프리픽스)

- [x] **C-3. 사이드바에 연간 리포트 메뉴 추가**
  - 파일: `src/components/layout/Navigation.tsx`
  - "도구" 그룹에 추가: `{ href: "/annual-report", label: "연간 리포트", icon: <CalendarIcon /> }`
  - CalendarIcon SVG 컴포넌트 추가 (기존 아이콘 패턴 참고: 24x24, stroke="currentColor", strokeWidth="2")
  - 모바일 탭바에는 공간 제한으로 미추가 (사이드바에서만 접근)

- [x] **C-4. 타입 정의**
  - 파일: `src/app/annual-report/page.tsx` 상단에 인터페이스 정의
  - API 응답 타입과 일치시킬 것

- [x] **C-5. 타입체크 + 접근성**
  - `npx tsc --noEmit` 통과
  - 차트에 aria-label 추가
  - 페이지 제목 `<h1>` 포함

---

## TODO (미완료)

> 상세: TODOS.md 참조

### P1 (높음)
- [ ] **Vercel 배포** — Turso 계정 + 환경변수 + 실제 URL 공유
- [ ] **신한카드 파서** — 신한카드 엑셀 형식 분석 + 구현

### P2 (중간)
- [ ] **PWA 지원** — manifest.json + service worker, 홈화면 설치
- [ ] **거래 태그** — DB tags 컬럼(JSON) + 필터링
- [ ] **PDF 내보내기** — 대시보드 데이터를 PDF로 다운로드
- [ ] **파서 단위 테스트** — 실제 엑셀 기반 테스트

### P3 (낮음)
- [ ] **토스 CSV 파서** — 토스 내보내기 가능 시
- [ ] **라이트 모드 세부 폴리시** — 세부 텍스트 대비 확인
