@AGENTS.md

# Smart Ledger - 프로젝트 컨벤션

## 기술 스택
- **프레임워크:** Next.js 15 (App Router, TypeScript)
- **스타일링:** Tailwind CSS v4
- **ORM:** Drizzle ORM
- **데이터베이스:** Turso (libSQL)
- **차트:** Recharts
- **엑셀 파싱:** SheetJS (xlsx)
- **인증:** bcryptjs + jsonwebtoken (공유 비밀번호 방식)

## 디렉토리 구조
```
src/
  app/           # Next.js App Router 페이지 및 API 라우트
  components/    # 재사용 가능한 UI 컴포넌트
    ui/          # 기본 UI 컴포넌트 (Card, Button, Input 등)
    charts/      # 차트 컴포넌트 (Recharts 래퍼)
    layout/      # 레이아웃 컴포넌트 (Navigation 등)
  db/            # Drizzle 스키마 및 DB 클라이언트
  lib/           # 유틸리티, 파서, 비즈니스 로직
    parsers/     # 엑셀 파서 (현대카드 등)
    analytics/   # 분석/인사이트 로직
data/            # 엑셀/PDF 원본 파일 (gitignore됨)
```

## 코딩 컨벤션
- **언어:** TypeScript 엄격 모드 (`strict: true`)
- **`any` / `unknown` 타입 사용 금지** - 반드시 구체적인 타입 정의
- **UI 언어:** 한국어 (모든 라벨, 메시지, 카테고리명)
- **금액 처리:** 항상 정수(원 단위)로 저장, 표시 시 `toLocaleString('ko-KR')` 사용
- **날짜 형식:** `YYYY-MM-DD` (DB 저장), `YYYY년 MM월 DD일` (UI 표시)
- **컴포넌트:** 함수형 컴포넌트 + React hooks
- **서버/클라이언트 구분:** 서버 컴포넌트 기본, `'use client'`는 필요한 경우에만
- **API 라우트:** `src/app/api/` 하위에 Route Handlers 사용
- **에러 처리:** try-catch + 적절한 HTTP 상태 코드 반환
- **새 타입:** 기존 types 파일에 추가 (별도 파일 생성 지양)
- **새 유틸:** 기존 유틸 파일에 추가

## 타입체크
```bash
npx tsc --noEmit
```

## 개발 서버
```bash
npm run dev
```

## DB 마이그레이션
```bash
npx drizzle-kit push
```

## 환경변수
`.env.local` 파일에 다음 변수 필요:
- `TURSO_DATABASE_URL` - Turso DB URL
- `TURSO_AUTH_TOKEN` - Turso 인증 토큰
- `LEDGER_PASSWORD_HASH` - 공유 비밀번호 bcrypt 해시
- `AUTH_SECRET` - JWT 서명 키
