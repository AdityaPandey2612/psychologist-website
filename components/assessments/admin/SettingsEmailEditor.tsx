"use client";

import { Plus } from "lucide-react";
import { isValidEmail } from "@/lib/assessments/text";
import { Alert, FieldLabel, cx, inputClass } from "@/components/assessments/ui";
import { Panel, RowActions, TextAreaField, TextField, Toggle, removeAt, replaceAt } from "./SettingsControls";
import type { EditorProps } from "./types";

export function SettingsEmailEditor({ definition, onChange }: EditorProps) {
  const email = definition.email;
  const set = (patch: Partial<typeof email>) => onChange({ ...definition, email: { ...email, ...patch } });
  const setNotify = (patch: Partial<typeof email.adminNotify>) => set({ adminNotify: { ...email.adminNotify, ...patch } });
  const recipients = email.adminNotify.recipients;

  return (
    <Panel
      title="Email results"
      description="Emailing is optional. When it is on and the server has mail credentials, participants can tick a box to receive a summary of their results. The mail sign-in is kept on the server and never exposed to the browser (SMTP_* and MAIL_FROM in the environment take priority over it). Without any sign-in the option is simply not shown and no email is attempted."
    >
      <Toggle
        checked={email.enabled}
        onChange={(enabled) => set({ enabled })}
        label="Offer to email results"
        description="When off, participants only see their results on screen and are not asked for email consent."
      />

      {email.enabled && (
        <>
          <TextField
            label="Subject"
            value={email.subject}
            maxLength={200}
            onChange={(subject) => set({ subject })}
            help={
              <>
                You can use <code>{"{{assessment}}"}</code> for the assessment title and <code>{"{{name}}"}</code> for the participant’s name.
              </>
            }
          />
          <TextAreaField label="Opening message" value={email.intro} rows={3} maxLength={1000} onChange={(intro) => set({ intro })} />
          <TextAreaField label="Footer note" value={email.footer} rows={2} maxLength={600} onChange={(footer) => set({ footer })} optional />
          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle
              checked={email.includeLink}
              onChange={(includeLink) => set({ includeLink })}
              label="Include a private link to the full results"
              description="The link is unguessable and works for anyone who has it."
            />
            <Toggle checked={email.includePlan} onChange={(includePlan) => set({ includePlan })} label="Include the practice plan" description="Only if the plan is enabled in the Scoring tab." />
            <Toggle
              checked={email.attachReport !== false}
              onChange={(attachReport) => set({ attachReport })}
              label="Attach the PDF report to the email"
              description="A PDF copy of the result, the same as the Download PDF report button. If it cannot be made, the email is still sent without it."
            />
          </div>

          <div className="rounded-2xl border border-primary/15 bg-surface-soft/40 p-4">
            <Toggle
              checked={email.adminNotify.enabled}
              onChange={(enabled) => setNotify({ enabled })}
              label="Also notify these addresses about completed assessments"
              description="The practice inbox is always told. Addresses added here get the same note."
            />
            <Alert tone="info" className="mt-3">
              <strong>Details with consent, or always in “Everything” mode.</strong> In the Privacy settings, “Everything” sends every note with the person&apos;s name, email, result, number of questions answered and PDF report, and the form tells people so.
              Otherwise participants see a separate, unticked checkbox — “Share my results with the practice” — and the full note is sent only for those who tick it; for everyone else it only says that someone completed the self-check.
            </Alert>

            {email.adminNotify.enabled && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-primary-dark">Recipients (up to 5)</p>
                <ul className="space-y-3">
                  {recipients.map((address, i) => {
                    const invalid = address.trim() !== "" && !isValidEmail(address.trim());
                    const id = `notify-recipient-${i}`;
                    return (
                      <li key={i} className="flex flex-wrap items-start gap-2">
                        <div className="min-w-[14rem] flex-1">
                          <FieldLabel htmlFor={id}>
                            <span className="sr-only">Recipient {i + 1} email address</span>
                          </FieldLabel>
                          <input
                            id={id}
                            type="email"
                            value={address}
                            maxLength={254}
                            placeholder="name@example.com"
                            aria-label={`Recipient ${i + 1} email address`}
                            aria-invalid={invalid}
                            onChange={(e) => set({ adminNotify: { ...email.adminNotify, recipients: replaceAt(recipients, i, e.target.value.trim().toLowerCase()) } })}
                            className={cx(inputClass, invalid && "border-accent-ink")}
                          />
                          {invalid && <p className="mt-1 text-xs text-accent-ink">That doesn’t look like a valid email address.</p>}
                        </div>
                        <RowActions index={i} count={recipients.length} noun={`recipient ${i + 1}`} onRemove={() => setNotify({ recipients: removeAt(recipients, i) })} />
                      </li>
                    );
                  })}
                </ul>
                {recipients.length < 5 && (
                  <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setNotify({ recipients: [...recipients, ""] })}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Add recipient
                  </button>
                )}
                {recipients.length === 0 && <p className="text-sm text-accent-ink">Add at least one recipient or turn this off before publishing.</p>}
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
