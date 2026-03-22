import { NextRequest, NextResponse } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mercari Study Admin"',
    },
  });
}

export function middleware(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  try {
    const decoded = atob(authHeader.replace("Basic ", ""));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return unauthorizedResponse();
    }

    const incomingUser = decoded.slice(0, separatorIndex);
    const incomingPassword = decoded.slice(separatorIndex + 1);

    if (incomingUser !== username || incomingPassword !== password) {
      return unauthorizedResponse();
    }

    return NextResponse.next();
  } catch {
    return unauthorizedResponse();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/line/webhook|api/internal/send-due|api/uploads).*)",
  ],
};
