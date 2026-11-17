// "One-click unsubscribe" for email apps (the Unsubscribe button Gmail and
// others show). Email apps send a POST here with the person's private code.
// People clicking the link in an email go to the friendly page at
// /reminders/stop instead.
import { NextResponse, type NextRequest } from "next/server";
import { stopReminders } from "@/app/reminders/actions";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const result = await stopReminders(token);
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
}

// Someone opening the link in a browser: show the friendly page.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/reminders/stop";
  return NextResponse.redirect(url);
}
