import { site } from "../../data/site";

export const COL = {
  assessments: "assessments",
  versions: "assessmentVersions",
  submissions: "assessmentSubmissions",
  peers: "assessmentPeerResponses",
  emails: "assessmentEmails",
  categories: "assessmentCategories",
  stats: "assessmentStats",
} as const;

/** Absolute base URL used in emailed links (never taken from request headers). */
export function publicBaseUrl(): string {
  const configured = process.env.ASSESSMENT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || site.url;
  return configured.replace(/\/+$/, "");
}

export const SITE_NAME = site.name;

export const versionId = (assessmentId: string, version: number) => `${assessmentId}__v${version}`;
