import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 인증이 필요 없는 경로
const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 인증 불필요
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 쿠키에서 인증 토큰 확인
  const token = request.cookies.get("ledger-auth")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // JWT 검증은 미들웨어(Edge Runtime)에서 jsonwebtoken을 사용할 수 없으므로
  // 토큰 존재 여부만 확인하고, 실제 검증은 API 라우트에서 수행
  // Edge에서는 간단한 토큰 구조 검증만 수행
  const parts = token.split(".");
  if (parts.length !== 3) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico 등 정적 파일 제외
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
