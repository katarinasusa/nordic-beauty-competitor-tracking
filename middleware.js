import { NextResponse } from "next/server";

const PASSWORD = "beautymatas26";
const COOKIE   = "nbi_auth";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow auth endpoint through
  if (pathname === "/api/auth") return NextResponse.next();

  // Check cookie
  const auth = req.cookies.get(COOKIE)?.value;
  if (auth === PASSWORD) return NextResponse.next();

  // Redirect to login for page requests, block API calls
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
