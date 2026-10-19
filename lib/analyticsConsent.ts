// Shared by the consent banner, the footer button and the root layout.
export const CLARITY_PROJECT_ID = "yyoyal8o77";
export const CONSENT_STORAGE_KEY = "cr-analytics-consent";
export const CONSENT_ATTRIBUTE = "data-analytics-consent";

// Runs before the page paints (rendered at the top of <body>) so the banner,
// which is part of the server HTML, is hidden for visitors who already chose.
// Rendering the banner on the server keeps it from becoming a late LCP element.
export const consentBootstrapScript = `try{var c=localStorage.getItem("${CONSENT_STORAGE_KEY}");if(c==="granted"||c==="denied")document.documentElement.setAttribute("${CONSENT_ATTRIBUTE}",c)}catch(e){}`;
