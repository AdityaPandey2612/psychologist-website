import { escapeHtml } from "../text";
import type { AssessmentDefinition, AssessmentResult } from "../types";

// Responsive HTML (table layout, inline styles) plus a plain-text alternative.
// Everything user- or admin-supplied goes through escapeHtml.

const C = {
  ink: "#16302E",
  soft: "#4C6864",
  primary: "#1F5C56",
  dark: "#123A36",
  bg: "#EEF3F1",
  line: "#D5E2DD",
  accent: "#AB471E",
};

export interface EmailContext {
  name: string;
  /** Set when a PDF copy of the report is attached; the email then says so. */
  attached?: boolean;
  assessmentTitle: string;
  completedAt: Date;
  result: AssessmentResult;
  definition: AssessmentDefinition;
  resultUrl?: string;
  siteName: string;
  /** Absolute URL of the practice logo shown at the top of the email. */
  logoUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function applyTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function h2(text: string): string {
  return `<h2 style="margin:28px 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:${C.dark};">${escapeHtml(text)}</h2>`;
}

function para(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.ink};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function bar(label: string, score: number | null, note?: string): string {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  return `<tr><td style="padding:6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:14px;color:${C.ink};">${escapeHtml(label)}${note ? ` <span style="color:${C.soft};">· ${escapeHtml(note)}</span>` : ""}</td>
      <td align="right" style="font-size:14px;font-weight:600;color:${C.dark};">${score === null ? "—" : score}</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;"><tr>
      <td style="background:${C.line};border-radius:6px;height:8px;line-height:8px;font-size:0;">
        <table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0"><tr><td style="background:${C.primary};border-radius:6px;height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr></table>
      </td>
    </tr></table>
  </td></tr>`;
}

/** The branded frame shared by every email: logo, teal band, heading, then the body. */
function wrapEmail(o: { subject: string; siteName: string; logoUrl?: string; title: string; subtitle?: string; body: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(o.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Arial,sans-serif;">
    <tr><td align="center" style="background:#ffffff;padding:26px 28px 18px;">${o.logoUrl ? `<img src="${escapeHtml(o.logoUrl)}" width="220" alt="${escapeHtml(o.siteName)}" style="display:block;width:220px;max-width:100%;height:auto;border:0;">` : `<div style="font-family:Georgia,serif;font-size:22px;color:${C.dark};">${escapeHtml(o.siteName)}</div>`}</td></tr>
    <tr><td style="background:${C.dark};height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:22px 28px 0;"><div style="font-family:Georgia,serif;font-size:22px;color:${C.dark};">${escapeHtml(o.title)}</div>${o.subtitle ? `<div style="font-size:13px;color:${C.soft};margin-top:6px;">${escapeHtml(o.subtitle)}</div>` : ""}</td></tr>
    <tr><td style="padding:24px 28px 28px;">${o.body}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td style="background:${C.primary};border-radius:999px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderResultEmail(ctx: EmailContext): RenderedEmail {
  const { result, definition } = ctx;
  const cfg = definition.email;
  const subject = applyTokens(cfg.subject, { assessment: ctx.assessmentTitle, name: ctx.name }).slice(0, 200);
  const first = ctx.name.split(/\s+/)[0] || ctx.name;
  const recs = result.content.filter((c) => c.kind === "recommendation" || c.kind === "message");
  const html: string[] = [];
  const text: string[] = [];

  html.push(para(`Hello ${first},`));
  html.push(para(cfg.intro));
  text.push(`Hello ${first},`, "", cfg.intro, "");
  text.push(`${ctx.assessmentTitle} — completed ${formatDate(ctx.completedAt)}`, "");

  // Support messages (for example crisis contacts) come first.
  for (const s of result.content.filter((c) => c.kind === "support")) {
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#FBEEE5;border-left:4px solid ${C.accent};border-radius:8px;"><tr><td style="padding:16px 18px;">${s.title ? `<div style="font-family:Georgia,serif;font-size:18px;color:${C.dark};margin-bottom:6px;">${escapeHtml(s.title)}</div>` : ""}${para(s.text)}</td></tr></table>`);
    text.push(s.title ? `${s.title.toUpperCase()}` : "SUPPORT", s.text, "");
  }

  // A zone takes the place of the overall score: it is the headline of the result.
  if (result.zone) {
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${C.bg};border-radius:14px;"><tr><td style="padding:22px;" align="center">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent};font-weight:700;">Your zone</div>
      <div style="font-family:Georgia,serif;font-size:32px;line-height:1.2;color:${C.dark};margin:8px 0;">${escapeHtml(result.zone.label)}</div>
      ${result.zone.description ? `<div style="font-size:14px;line-height:1.55;color:${C.soft};">${escapeHtml(result.zone.description)}</div>` : ""}
    </td></tr></table>`);
    text.push(`ZONE: ${result.zone.label}`);
    if (result.zone.description) text.push(result.zone.description);
    text.push("");
  }

  if (result.scored && result.overall !== null && !result.zone) {
    const shown = result.display ? result.display.score : result.overall;
    const outOf = result.display ? result.display.max : 100;
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${C.bg};border-radius:14px;"><tr><td style="padding:22px;" align="center">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent};font-weight:700;">Overall score</div>
      <div style="font-family:Georgia,serif;font-size:48px;line-height:1.1;color:${C.dark};margin:6px 0;">${shown}<span style="font-size:20px;color:${C.soft};"> / ${outOf}</span></div>
      ${result.level ? `<div style="font-size:18px;font-weight:600;color:${C.primary};">${escapeHtml(result.level.label)}</div><div style="font-size:14px;line-height:1.5;color:${C.soft};margin-top:6px;">${escapeHtml(result.level.description)}</div>` : ""}
    </td></tr></table>`);
    text.push(`OVERALL SCORE: ${shown} / ${outOf}${result.level ? ` — ${result.level.label}` : ""}`);
    if (result.level) text.push(result.level.description);
    text.push("");
  }

  const skills = result.skills.filter((s) => s.score !== null);
  if (skills.length) {
    html.push(h2("Your skills"));
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${skills.map((s) => bar(s.name, s.score, s.band)).join("")}</table>`);
    text.push("YOUR SKILLS");
    for (const s of skills) text.push(`- ${s.name}: ${s.score}${s.band ? ` (${s.band})` : ""}`);
    text.push("");
  }

  const contexts = result.contexts.filter((c) => c.score !== null);
  if (contexts.length >= 2) {
    html.push(h2(contexts.map((c) => c.name).join(" and ")));
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${contexts.map((c) => bar(c.name, c.score)).join("")}</table>`);
    if (result.contextComparison) html.push(`<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${C.soft};">${escapeHtml(result.contextComparison.message)}</p>`);
    text.push(contexts.map((c) => c.name).join(" / ").toUpperCase());
    for (const c of contexts) text.push(`- ${c.name}: ${c.score}`);
    if (result.contextComparison) text.push(result.contextComparison.message);
    text.push("");
  }

  if (result.strengths.length) {
    html.push(h2("Your strengths"));
    html.push(result.strengths.map((s) => para(`${s.name} (${s.score}): ${s.text}`)).join(""));
    text.push("YOUR STRENGTHS", ...result.strengths.map((s) => `- ${s.name} (${s.score}): ${s.text}`), "");
  }
  if (result.growth.length) {
    html.push(h2("Where you could grow"));
    html.push(
      result.growth
        .map((g) => para(`${g.name} (${g.score}): ${g.text}`) + (g.tips.length ? `<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.6;color:${C.ink};">${g.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""))
        .join(""),
    );
    text.push("WHERE YOU COULD GROW");
    for (const g of result.growth) {
      text.push(`- ${g.name} (${g.score}): ${g.text}`);
      for (const t of g.tips) text.push(`    * ${t}`);
    }
    text.push("");
  }

  if (recs.length) {
    html.push(h2("Recommendations"));
    html.push(recs.map((r) => para(`${r.title ? `${r.title}: ` : ""}${r.text}`)).join(""));
    text.push("RECOMMENDATIONS", ...recs.map((r) => `- ${r.title ? `${r.title}: ` : ""}${r.text}`), "");
  }

  if (cfg.includePlan && result.practicePlan) {
    html.push(h2(result.practicePlan.title));
    if (result.practicePlan.intro) html.push(para(result.practicePlan.intro));
    text.push(result.practicePlan.title.toUpperCase());
    for (const week of result.practicePlan.weeks) {
      if (result.practicePlan.steps) {
        const step = week.practices[0]?.text ?? "";
        html.push(`<p style="margin:10px 0;font-size:15px;line-height:1.6;color:${C.ink};"><strong style="color:${C.primary};">${escapeHtml(week.title)}.</strong> ${escapeHtml(step)}</p>`);
        text.push(`${week.title}: ${step}`);
        continue;
      }
      html.push(`<p style="margin:14px 0 4px;font-size:15px;font-weight:700;color:${C.primary};">${escapeHtml(week.title)} <span style="font-weight:400;color:${C.soft};">(${escapeHtml(week.days)})</span></p>`);
      if (week.goal) html.push(`<p style="margin:0 0 6px;font-size:14px;color:${C.soft};">${escapeHtml(week.goal)}</p>`);
      html.push(`<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.6;color:${C.ink};">${week.practices.map((p) => `<li>${escapeHtml(p.text)}</li>`).join("")}</ul>`);
      text.push(`${week.title} (${week.days})`, ...week.practices.map((p) => `  - ${p.text}`));
    }
    text.push("");
  }

  if (ctx.attached) {
    html.push(`<p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:${C.soft};">A PDF copy of your report is attached to this email.</p>`);
    text.push("A PDF copy of your report is attached to this email.", "");
  }

  if (cfg.includeLink && ctx.resultUrl) {
    html.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;"><tr><td style="background:${C.primary};border-radius:999px;"><a href="${escapeHtml(ctx.resultUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your full results</a></td></tr></table>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.soft};">This link is private to you — anyone who has it can see your results, so please don't share it.</p>`);
    text.push(`View your full results: ${ctx.resultUrl}`, "(This link is private to you — please don't share it.)", "");
  }

  html.push(`<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.soft};">${escapeHtml(definition.results.disclaimer)}</p>`);
  if (cfg.footer) html.push(`<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${C.soft};">${escapeHtml(cfg.footer)}</p>`);
  text.push("--", definition.results.disclaimer);
  if (cfg.footer) text.push(cfg.footer);

  const doc = wrapEmail({
    subject,
    siteName: ctx.siteName,
    logoUrl: ctx.logoUrl,
    title: ctx.assessmentTitle,
    subtitle: `Completed ${formatDate(ctx.completedAt)}`,
    body: html.join("\n"),
  });

  return { subject, html: doc, text: text.join("\n") };
}

export function renderAdminNotification(ctx: {
  name: string;
  email: string;
  assessmentTitle: string;
  completedAt: Date;
  result: AssessmentResult;
  siteName: string;
  /** True when the participant agreed to share their results; otherwise nothing personal is included. */
  shared?: boolean;
  /** Set when the participant's PDF report is attached; the email then says so. */
  attached?: boolean;
  /** Link to the submissions screen in the admin. */
  adminUrl?: string;
  logoUrl?: string;
}): RenderedEmail {
  const shared = ctx.shared ?? true;
  const when = formatDate(ctx.completedAt);
  const html: string[] = [];
  const text: string[] = [];

  if (!shared) {
    const subject = `New self-check completed: ${ctx.assessmentTitle}`.slice(0, 200);
    const line = `Someone completed "${ctx.assessmentTitle}" on ${when}. They did not choose to share their name, email or results with the practice, so none are included here.`;
    html.push(para(line));
    text.push(line, "");
    if (ctx.adminUrl) {
      html.push(button("Open the admin", ctx.adminUrl));
      text.push(`Open the admin: ${ctx.adminUrl}`, "");
    }
    html.push(`<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${C.soft};">Sent by ${escapeHtml(ctx.siteName)} to let you know a self-check was completed.</p>`);
    text.push(`Sent by ${ctx.siteName} to let you know a self-check was completed.`);
    return {
      subject,
      html: wrapEmail({ subject, siteName: ctx.siteName, logoUrl: ctx.logoUrl, title: ctx.assessmentTitle, subtitle: `Completed ${when}`, body: html.join("\n") }),
      text: text.join("\n"),
    };
  }

  const { result } = ctx;
  const subject = `New self-check result: ${ctx.assessmentTitle} (${ctx.name})`.slice(0, 200);
  const intro = `${ctx.name} (${ctx.email}) completed "${ctx.assessmentTitle}" on ${when} and agreed to share their results with the practice.`;
  html.push(para(intro));
  text.push(intro, "");

  if (result.content.some((c) => c.kind === "support")) {
    const note = "This person's answers triggered a support message (they were shown crisis contact details). You may want to follow up.";
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#FBEEE5;border-left:4px solid ${C.accent};border-radius:8px;"><tr><td style="padding:14px 18px;font-size:15px;line-height:1.6;color:${C.ink};"><strong style="color:${C.accent};">Please note.</strong> ${escapeHtml(note)}</td></tr></table>`);
    text.push(`NOTE: ${note}`, "");
  }

  if (result.zone) {
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:${C.bg};border-radius:14px;"><tr><td style="padding:20px;" align="center">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent};font-weight:700;">Zone</div>
      <div style="font-family:Georgia,serif;font-size:28px;line-height:1.2;color:${C.dark};margin-top:6px;">${escapeHtml(result.zone.label)}</div>
    </td></tr></table>`);
    text.push(`Zone: ${result.zone.label}`);
  } else if (result.scored && result.overall !== null) {
    const shown = result.display ? result.display.score : result.overall;
    const outOf = result.display ? result.display.max : 100;
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:${C.bg};border-radius:14px;"><tr><td style="padding:20px;" align="center">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent};font-weight:700;">Overall score</div>
      <div style="font-family:Georgia,serif;font-size:42px;line-height:1.1;color:${C.dark};margin:6px 0;">${shown}<span style="font-size:18px;color:${C.soft};"> / ${outOf}</span></div>
      ${result.level ? `<div style="font-size:17px;font-weight:600;color:${C.primary};">${escapeHtml(result.level.label)}</div>` : ""}
    </td></tr></table>`);
    text.push(`Overall score: ${shown} / ${outOf}${result.level ? ` (${result.level.label})` : ""}`);
  } else {
    html.push(para("This assessment is not scored."));
    text.push("This assessment is not scored.");
  }

  const skills = result.skills.filter((s) => s.score !== null);
  if (skills.length) {
    html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${skills.map((s) => bar(s.name, s.score, s.band)).join("")}</table>`);
    text.push("", ...skills.map((s) => `${s.name}: ${s.score}`));
  }
  text.push("");

  if (ctx.attached) {
    html.push(`<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${C.soft};">Their full report is attached as a PDF.</p>`);
    text.push("Their full report is attached as a PDF.", "");
  }
  if (ctx.adminUrl) {
    html.push(button("Open the admin", ctx.adminUrl));
    text.push(`Open the admin: ${ctx.adminUrl}`, "");
  }
  html.push(`<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.soft};">Sent by ${escapeHtml(ctx.siteName)} because the participant agreed to share their results with the practice.</p>`);
  text.push(`Sent by ${ctx.siteName} because the participant agreed to share their results with the practice.`);

  return {
    subject,
    html: wrapEmail({ subject, siteName: ctx.siteName, logoUrl: ctx.logoUrl, title: ctx.assessmentTitle, subtitle: `Completed ${when}`, body: html.join("\n") }),
    text: text.join("\n"),
  };
}
