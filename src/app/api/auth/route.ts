import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

interface AuthRequestBody {
  password: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthRequestBody;
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const passwordHash = process.env.LEDGER_PASSWORD_HASH;
    const authSecret = process.env.AUTH_SECRET;

    if (!passwordHash || !authSecret) {
      console.error("환경변수 LEDGER_PASSWORD_HASH 또는 AUTH_SECRET이 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "서버 설정 오류입니다." },
        { status: 500 }
      );
    }

    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // JWT 토큰 생성 (7일 유효)
    const token = jwt.sign(
      { authenticated: true, iat: Math.floor(Date.now() / 1000) },
      authSecret,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ success: true });

    // 쿠키에 토큰 설정 (7일)
    response.cookies.set("ledger-auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "인증 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
