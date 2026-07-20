import { NextResponse } from "next/server";

// Protège toute l'appli sauf la page de connexion et l'API de login.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const sess = req.cookies.get("sess")?.value;
  if (sess && sess === process.env.APP_SESSION_SECRET) {
    return NextResponse.next();
  }

  // API protégée -> 401 ; pages -> redirection vers /login
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "non autorisé" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
