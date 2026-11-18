// Social profiles linked from the floating bar and the footer. Share-tracking
// parameters (utm_*, igsh) are deliberately left off.
export const socialLinks = [
  { name: "Instagram", href: "https://www.instagram.com/rajmeditation/" },
  { name: "YouTube", href: "https://www.youtube.com/channel/UCkg_00o4qZyzbbes3JJRibA" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/lt-col-rajesh-sharma-retd-06b4621b7/" },
  { name: "Facebook", href: "https://www.facebook.com/CRmentalhealthservices" }
] as const;

export type SocialName = (typeof socialLinks)[number]["name"];
