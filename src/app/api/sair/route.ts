import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/sessao";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/entrar", req.url), 303);
  res.cookies.delete(COOKIE_SESSAO);
  return res;
}
