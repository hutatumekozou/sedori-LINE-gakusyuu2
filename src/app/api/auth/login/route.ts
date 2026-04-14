import { NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE_NAME,
  APP_SESSION_COOKIE_VALUE,
  getAppLoginPassword,
  getSafeRedirectPath,
} from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const next = getSafeRedirectPath(String(formData.get("next") || "/items"));

  if (password !== getAppLoginPassword()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "パスワードが違います。");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL(next, request.url), {
    status: 303,
  });
  response.cookies.set(APP_SESSION_COOKIE_NAME, APP_SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
