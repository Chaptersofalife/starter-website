// The wording and design of every email the site sends.
// Colours match the website (src/theme/theme.css). Emails can't use the
// site's style files, so the colours are written here directly.
// Each email has an HTML version and a plain-text version.

const c = {
  ivory: "#faf6f0",
  ink: "#2f2a26",
  stone: "#675d54",
  sage: "#556b58",
  gold: "#b8976a",
  border: "#e2d6c6",
  white: "#ffffff",
};

type Email = { subject: string; html: string; text: string };

/** Makes typed text safe to place inside an email. */
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Keeps line breaks in typed text. */
function paragraphs(text: string) {
  return esc(text).replace(/\r?\n/g, "<br>");
}

function button(href: string, label: string) {
  return `<p style="margin:28px 0;"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;background:${c.sage};color:${c.white};text-decoration:none;font-weight:bold;border-radius:6px;">${esc(label)}</a></p>`;
}

function layout(title: string, body: string, footer: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${c.ivory};">
<div style="margin:0;padding:32px 16px;background:${c.ivory};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${c.white};border:1px solid ${c.border};border-radius:6px;">
    <tr><td style="padding:36px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${c.ink};">
      <p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${c.ink};">Chapters of a Life</p>
      ${body}
      <hr style="border:0;border-top:1px solid ${c.gold};width:56px;margin:28px 0 20px;text-align:left;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${c.stone};">${footer}</p>
    </td></tr>
  </table>
</div>
</body></html>`;
}

const h1 = (text: string) =>
  `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;line-height:1.3;color:${c.ink};">${esc(text)}</h1>`;
const p = (html: string) => `<p style="margin:0 0 16px;">${html}</p>`;
const quote = (text: string) =>
  `<div style="margin:0 0 20px;padding:14px 18px;border-left:3px solid ${c.gold};background:#f7f1e8;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;color:${c.ink};">${paragraphs(text)}</div>`;

const signOff = "Chapters of a Life · hello@chaptersofalife.co.uk";

// ---------------------------------------------------------------------------
// To invited family and friends
// ---------------------------------------------------------------------------

type InviteDetails = {
  /** The invited person's first name, if the organiser gave one. */
  toFirstName: string | null;
  organiserName: string;
  /** e.g. "Margaret Rose Ellis" */
  personFullName: string;
  /** e.g. "Peggy" (their known-as name, or first name) */
  personName: string;
  /** e.g. "8 December", or null if there's no closing date */
  closesOnText: string | null;
  /** Their personal invite link */
  link: string;
  /** Their "stop reminders" link */
  stopLink: string;
};

export function invitationEmail(d: InviteDetails & { message: string | null }): Email {
  const greeting = d.toFirstName ? `Dear ${d.toFirstName},` : "Hello,";
  const subject = `${d.organiserName} has invited you to share a memory of ${d.personName}`;
  const by = d.closesOnText ? ` Please add your memories by ${d.closesOnText}.` : "";
  const html = layout(
    subject,
    [
      h1(`Share a memory of ${d.personFullName}`),
      p(esc(greeting)),
      p(
        `${esc(d.organiserName)} is putting together a book of memories for ${esc(d.personName)}&rsquo;s family, and would love you to be part of it.`,
      ),
      d.message ? quote(d.message) + p(`<span style="color:${c.stone};">&mdash; ${esc(d.organiserName)}</span>`) : "",
      p(
        `You can share a favourite memory, a story, a photograph or a saying they loved. A few lines are just as precious as a long story, and you don&rsquo;t need an account.${esc(by)}`,
      ),
      button(d.link, "Add my memories"),
      p(`<span style="font-size:14px;color:${c.stone};">If the button doesn&rsquo;t work, copy this link into your browser:<br><a href="${esc(d.link)}" style="color:${c.sage};word-break:break-all;">${esc(d.link)}</a></span>`),
    ].join(""),
    `You&rsquo;re receiving this because ${esc(d.organiserName)} invited you. Replying to this email will reach them.<br>Don&rsquo;t want reminders about this book? <a href="${esc(d.stopLink)}" style="color:${c.stone};">Stop reminders</a>.<br>${esc(signOff)}`,
  );
  const text = [
    greeting,
    "",
    `${d.organiserName} is putting together a book of memories for ${d.personName}'s family, and would love you to be part of it.`,
    ...(d.message ? ["", d.message, `— ${d.organiserName}`] : []),
    "",
    `You can share a favourite memory, a story, a photograph or a saying they loved. A few lines are just as precious as a long story, and you don't need an account.${by}`,
    "",
    `Add your memories: ${d.link}`,
    "",
    `Replying to this email will reach ${d.organiserName}.`,
    `Stop reminders about this book: ${d.stopLink}`,
    signOff,
  ].join("\n");
  return { subject, html, text };
}

export function reminderEmail(d: InviteDetails & { daysLeft: number }): Email {
  const greeting = d.toFirstName ? `Dear ${d.toFirstName},` : "Hello,";
  const when = d.daysLeft <= 1 ? "tomorrow" : `in ${d.daysLeft} days`;
  const subject = `A gentle reminder: memories of ${d.personName}`;
  const html = layout(
    subject,
    [
      h1(`Memories of ${d.personFullName}`),
      p(esc(greeting)),
      p(
        `Just a gentle reminder that ${esc(d.organiserName)} is gathering memories of ${esc(d.personName)} for a book for the family. It closes to new memories ${when}${d.closesOnText ? `, on ${esc(d.closesOnText)}` : ""}.`,
      ),
      p("If you&rsquo;d like to be part of it, there&rsquo;s still time. Even a few lines or a single photograph would mean a great deal."),
      button(d.link, "Add my memories"),
      p(`<span style="font-size:14px;color:${c.stone};">If the button doesn&rsquo;t work, copy this link into your browser:<br><a href="${esc(d.link)}" style="color:${c.sage};word-break:break-all;">${esc(d.link)}</a></span>`),
    ].join(""),
    `You&rsquo;re receiving this because ${esc(d.organiserName)} invited you. <a href="${esc(d.stopLink)}" style="color:${c.stone};">Stop reminders about this book</a>.<br>${esc(signOff)}`,
  );
  const text = [
    greeting,
    "",
    `Just a gentle reminder that ${d.organiserName} is gathering memories of ${d.personName} for a book for the family. It closes to new memories ${when}${d.closesOnText ? `, on ${d.closesOnText}` : ""}.`,
    "",
    "If you'd like to be part of it, there's still time. Even a few lines or a single photograph would mean a great deal.",
    "",
    `Add your memories: ${d.link}`,
    "",
    `Stop reminders about this book: ${d.stopLink}`,
    signOff,
  ].join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// To the organiser
// ---------------------------------------------------------------------------

type OrganiserDetails = {
  organiserFirstName: string;
  personName: string;
  memories: number;
  photos: number;
  /** The organiser's book page */
  bookUrl: string;
};

const countText = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function organiserSummaryEmail(
  d: OrganiserDetails & { closesOnText: string; daysLeft: number; notYet: string[] },
): Email {
  const when = d.daysLeft <= 1 ? "tomorrow" : `in ${d.daysLeft} days`;
  const subject = `${d.personName}'s book closes ${when}`;
  const list = d.notYet.slice(0, 30);
  const more = d.notYet.length - list.length;
  const html = layout(
    subject,
    [
      h1(`${d.personName}’s book closes ${when}`),
      p(`Dear ${esc(d.organiserFirstName)},`),
      p(
        `The book closes to new memories on ${esc(d.closesOnText)}. So far, family and friends have shared <strong>${countText(d.memories, "memory", "memories")}</strong> and <strong>${countText(d.photos, "photo", "photos")}</strong>.`,
      ),
      d.notYet.length > 0
        ? p("These people you invited haven&rsquo;t added a memory yet. They&rsquo;ll receive a gentle reminder too:") +
          `<ul style="margin:0 0 16px;padding-left:20px;">${list.map((n) => `<li>${esc(n)}</li>`).join("")}${more > 0 ? `<li>and ${more} more</li>` : ""}</ul>`
        : p("Everyone you invited by email has added a memory."),
      p("If you&rsquo;d like more time, you can change the closing date on the book&rsquo;s page."),
      button(d.bookUrl, "Open the book"),
    ].join(""),
    esc(signOff),
  );
  const text = [
    `Dear ${d.organiserFirstName},`,
    "",
    `The book closes to new memories on ${d.closesOnText}. So far, family and friends have shared ${countText(d.memories, "memory", "memories")} and ${countText(d.photos, "photo", "photos")}.`,
    "",
    ...(d.notYet.length > 0
      ? ["These people you invited haven't added a memory yet:", ...list.map((n) => `- ${n}`), ...(more > 0 ? [`- and ${more} more`] : [])]
      : ["Everyone you invited by email has added a memory."]),
    "",
    "If you'd like more time, you can change the closing date on the book's page.",
    "",
    `Open the book: ${d.bookUrl}`,
    signOff,
  ].join("\n");
  return { subject, html, text };
}

export function organiserClosedEmail(d: OrganiserDetails & { waiting: number }): Email {
  const subject = `${d.personName}'s book is now closed`;
  const html = layout(
    subject,
    [
      h1(`${d.personName}’s book is now closed`),
      p(`Dear ${esc(d.organiserFirstName)},`),
      p(
        `The book is now closed to new memories. Family and friends shared <strong>${countText(d.memories, "memory", "memories")}</strong> and <strong>${countText(d.photos, "photo", "photos")}</strong>.`,
      ),
      d.waiting > 0
        ? p(`${countText(d.waiting, "memory is", "memories are")} waiting for you to review. When you&rsquo;re ready, you can read each one, correct any typos, and choose what goes in the book.`)
        : p("When you&rsquo;re ready, you can read through everything and choose what goes in the book."),
      p("Take your time. If you&rsquo;d like to welcome a few more memories, you can reopen the book at any point."),
      button(d.bookUrl, "Review the memories"),
    ].join(""),
    esc(signOff),
  );
  const text = [
    `Dear ${d.organiserFirstName},`,
    "",
    `The book is now closed to new memories. Family and friends shared ${countText(d.memories, "memory", "memories")} and ${countText(d.photos, "photo", "photos")}.`,
    "",
    d.waiting > 0
      ? `${countText(d.waiting, "memory is", "memories are")} waiting for you to review. When you're ready, you can read each one, correct any typos, and choose what goes in the book.`
      : "When you're ready, you can read through everything and choose what goes in the book.",
    "",
    "Take your time. If you'd like to welcome a few more memories, you can reopen the book at any point.",
    "",
    `Review the memories: ${d.bookUrl}`,
    signOff,
  ].join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

type OrderEmailDetails = {
  orderRef: string;
  bookName: string;
  totalCopies: number;
  extraCopies: number;
  amount: string;
  address: string[];
  paidOn: string;
};

function orderTable(d: OrderEmailDetails) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:${c.stone};vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;vertical-align:top;">${value}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;line-height:1.5;">${[
    row("Order", esc(d.orderRef)),
    row("Book", `Keepsake book for ${esc(d.bookName)}`),
    row("Copies", `${d.totalCopies}${d.extraCopies > 0 ? ` (1 + ${d.extraCopies} extra)` : ""}`),
    row("Paid", `${esc(d.amount)} on ${esc(d.paidOn)}`),
    row("Delivering to", d.address.map(esc).join("<br>")),
  ].join("")}</table>`;
}

function orderText(d: OrderEmailDetails) {
  return [
    `Order: ${d.orderRef}`,
    `Book: Keepsake book for ${d.bookName}`,
    `Copies: ${d.totalCopies}${d.extraCopies > 0 ? ` (1 + ${d.extraCopies} extra)` : ""}`,
    `Paid: ${d.amount} on ${d.paidOn}`,
    "Delivering to:",
    ...d.address.map((l) => `  ${l}`),
  ].join("\n");
}

export function orderConfirmationEmail(
  d: OrderEmailDetails & { organiserFirstName: string; previewDays: number; bookUrl: string },
): Email {
  const subject = `Thank you for your order: ${d.bookName}'s book`;
  const html = layout(
    subject,
    [
      h1("Thank you for your order"),
      p(`Dear ${esc(d.organiserFirstName)},`),
      p(
        `Thank you for trusting us with ${esc(d.bookName)}&rsquo;s book. We&rsquo;ve received your payment, and we&rsquo;ll now begin designing the pages with care.`,
      ),
      orderTable(d),
      `<h2 style="margin:24px 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:normal;color:${c.ink};">What happens next</h2>`,
      `<ol style="margin:0 0 16px;padding-left:20px;">
        <li style="margin-bottom:6px;">We design your book using the memories and photographs you approved.</li>
        <li style="margin-bottom:6px;">Within ${d.previewDays} working days, we&rsquo;ll send you a preview to look through.</li>
        <li style="margin-bottom:6px;">Nothing is printed until you approve it.</li>
        <li>Your book is printed, bound and delivered to your door.</li>
      </ol>`,
      p("If you have any questions, simply reply to this email."),
      button(d.bookUrl, "View your book"),
    ].join(""),
    esc(signOff),
  );
  const text = [
    `Dear ${d.organiserFirstName},`,
    "",
    `Thank you for trusting us with ${d.bookName}'s book. We've received your payment, and we'll now begin designing the pages with care.`,
    "",
    orderText(d),
    "",
    "What happens next:",
    "1. We design your book using the memories and photographs you approved.",
    `2. Within ${d.previewDays} working days, we'll send you a preview to look through.`,
    "3. Nothing is printed until you approve it.",
    "4. Your book is printed, bound and delivered to your door.",
    "",
    "If you have any questions, simply reply to this email.",
    `View your book: ${d.bookUrl}`,
    signOff,
  ].join("\n");
  return { subject, html, text };
}

export function newOrderAdminEmail(
  d: OrderEmailDetails & { organiserName: string; organiserEmail: string; adminUrl: string; testMode: boolean },
): Email {
  const subject = `${d.testMode ? "[TEST] " : ""}New order: ${d.bookName} (${d.amount})`;
  const html = layout(
    subject,
    [
      h1("New order"),
      d.testMode ? p(`<strong>Test mode:</strong> no real money was taken.`) : "",
      p(`From ${esc(d.organiserName)} (<a href="mailto:${esc(d.organiserEmail)}" style="color:${c.sage};">${esc(d.organiserEmail)}</a>).`),
      orderTable(d),
      button(d.adminUrl, "Open in admin"),
    ].join(""),
    esc(signOff),
  );
  const text = [
    d.testMode ? "TEST MODE: no real money was taken.\n" : "",
    `From ${d.organiserName} (${d.organiserEmail})`,
    "",
    orderText(d),
    "",
    `Open in admin: ${d.adminUrl}`,
  ].join("\n");
  return { subject, html, text };
}
