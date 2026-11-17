// Netlify runs this once a day (see `schedule` below) to send reminder emails.
// It asks the website to do the check, using the secret CRON_SECRET, so the
// reminder logic lives in one place: src/lib/reminders.ts.
//
// Scheduled functions only run on the live site (not on previews).
// You can see each run in Netlify: Logs > Functions > daily-reminders.

export default async function dailyReminders() {
  // URL is set by Netlify: the site's main address (your custom domain).
  const base = process.env.URL ?? "https://www.chaptersofalife.co.uk";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set, so reminders were not sent.");
    return;
  }

  const response = await fetch(`${base}/api/cron/reminders`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log("Reminder check finished:", response.status, await response.text());
}

// Every day at 08:00 UTC (8am in winter, 9am in summer, UK time).
export const config = {
  schedule: "0 8 * * *",
};
