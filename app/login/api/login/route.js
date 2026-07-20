import { NextResponse } from "next/server";

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const { password } = body;

  if (!process.env.APP_PASSWORD || !process.env.APP_SESSION_SECRET) {
    return NextResponse.json(
      { error: "Configuration manquante (APP_PASSWORD / APP_SESSION_SECRET)." },
      { status: 500 }
    );
  }

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("sess", process.env.APP_SESSION_SECRET, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}
