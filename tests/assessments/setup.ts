// Imported first by the tests that submit assessments.
//  * The Gmail sign-in kept in source is switched off, so a test can never send a real email.
//  * Emails are sent before submitAssessment() returns, so a test can check what was sent.
import { setInlineBackgroundForTests } from "../../lib/assessments/server/background";

process.env.ASSESSMENT_IGNORE_EMBEDDED_MAIL = "1";
setInlineBackgroundForTests(true);
