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
