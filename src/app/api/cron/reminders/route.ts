// The daily reminder check: chaptersofalife.co.uk/api/cron/reminders
// Called once a day by the Netlify scheduled function in
// netlify/functions/daily-reminders.mts. It only runs with the secret
// CRON_SECRET, so nobody else can trigger it.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";
import { siteUrl } from "@/lib/site";

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  // Links in reminder emails always use the real website address.
  const report = await runReminders(siteUrl);
  console.log("Reminder check:", JSON.stringify(report));
  return NextResponse.json(report);
}
