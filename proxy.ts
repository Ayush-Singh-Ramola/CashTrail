import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    if (isAuthPage) return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifyToken(token);
  if (session) return isAuthPage ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();

  if (isAuthPage) {
    const response = NextResponse.next();
    response.cookies.set("auth-token", "", { path: "/", maxAge: 0 });
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set("auth-token", "", { path: "/", maxAge: 0 });
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/imports/:path*",
    "/transactions/:path*",
    "/reports/:path*",
    "/compare/:path*",
    "/settings/:path*",
  ],
};
