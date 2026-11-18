import { PDFDocument, degrees, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { site } from "../../../data/site";
import { questionCounts } from "../../counts";
import type { Answers, AssessmentDefinition, AssessmentResult } from "../../types";
import { FONT_DATA, LOGO } from "./assets";
import { PAGE, layoutReport, type FontKey, type Metrics, type Op, type ReportInput } from "./reportLayout";

const decode = (base64: string) => Uint8Array.from(Buffer.from(base64, "base64"));

function color(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

export type ReportData = Omit<ReportInput, "logoRatio" | "brand"> & { brand?: string };

/** The participant's report as a PDF file (A4, the site's fonts and logo). */
export async function renderReportPdf(data: ReportData): Promise<Uint8Array> {
  const brand = data.brand ?? site.shortName;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Record<FontKey, PDFFont> = {
    display: await doc.embedFont(decode(FONT_DATA.displayRegular), { subset: true }),
    sans: await doc.embedFont(decode(FONT_DATA.sansRegular), { subset: true }),
    sansBold: await doc.embedFont(decode(FONT_DATA.sansBold), { subset: true }),
  };
  const logo = await doc.embedJpg(decode(LOGO.jpeg));
  const characters = Object.values(fonts).map((font) => new Set(font.getCharacterSet()));
  const metrics: Metrics = {
    width: (text, font, size) => fonts[font].widthOfTextAtSize(text, size),
    // Only what every font has is drawn, so a line never mixes real letters with empty boxes.
    supported: (codePoint) => characters.every((set) => set.has(codePoint)),
  };
  const pages = layoutReport({ ...data, brand, logoRatio: LOGO.width / LOGO.height }, metrics);

  for (const layoutPage of pages) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const flip = (y: number) => PAGE.height - y;
    const draw = (op: Op) => {
      switch (op.type) {
        case "rect":
          page.drawRectangle({
            x: op.x,
            y: flip(op.y + op.height),
            width: op.width,
            height: op.height,
            ...(op.fill ? { color: color(op.fill) } : {}),
            ...(op.stroke ? { borderColor: color(op.stroke), borderWidth: op.strokeWidth ?? 1 } : {}),
          });
          break;
        case "line":
          page.drawLine({ start: { x: op.x1, y: flip(op.y1) }, end: { x: op.x2, y: flip(op.y2) }, thickness: op.width, color: color(op.stroke), ...(op.dash ? { dashArray: op.dash } : {}) });
          break;
        case "circle":
          page.drawCircle({
            x: op.x,
            y: flip(op.y),
            size: op.radius,
            ...(op.fill ? { color: color(op.fill) } : {}),
            ...(op.stroke ? { borderColor: color(op.stroke), borderWidth: op.strokeWidth ?? 1, borderOpacity: op.opacity ?? 1 } : {}),
          });
          break;
        case "text":
          page.drawText(op.text, { x: op.x, y: flip(op.y), size: op.size, font: fonts[op.font], color: color(op.color), ...(op.rotate ? { rotate: degrees(op.rotate) } : {}) });
          break;
        case "logo":
          page.drawImage(logo, { x: op.x, y: flip(op.y + op.height), width: op.width, height: op.height });
          break;
      }
    };
    layoutPage.ops.forEach(draw);
  }

  doc.setTitle(`${data.assessmentTitle} — report for ${data.participantName}`);
  doc.setAuthor(brand);
  doc.setSubject(data.assessmentTitle);
  doc.setCreator(brand);
  doc.setProducer(brand);
  const completed = new Date(data.completedAt);
  if (!Number.isNaN(completed.getTime())) doc.setCreationDate(completed);
  doc.setLanguage("en-IN");
  return doc.save();
}

/** A file name that is safe on every system: the assessment and the person, in plain letters and digits. */
export function reportFileName(assessmentTitle: string, participantName: string) {
  const plain = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [plain(assessmentTitle) || "Assessment", plain(participantName)].filter(Boolean);
  return `${parts.join("-").slice(0, 80).replace(/-+$/, "")}-report.pdf`;
}

/** What the report needs from a stored submission's version of the assessment. */
export function reportDataFor(input: {
  assessmentTitle: string;
  participantName: string;
  completedAt: string;
  result: AssessmentResult;
  definition: AssessmentDefinition;
  /** The participant's answers: the report then says how many questions were answered. */
  answers?: Answers;
}): ReportData {
  return {
    assessmentTitle: input.assessmentTitle,
    participantName: input.participantName,
    completedAt: input.completedAt,
    ...(input.answers ? { questions: questionCounts(input.definition, input.answers) } : {}),
    result: input.result,
    results: input.definition.results,
    zoneMap: input.definition.scoring.zoneMap ?? null,
  };
}
