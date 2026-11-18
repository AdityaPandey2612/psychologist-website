"use client";

import { ZONE_KEYS, type AssessmentDefinition, type Skill, type ZoneKey, type ZoneMapConfig } from "@/lib/assessments/types";
import { Alert } from "@/components/assessments/ui";
import { NumberField, Panel, SelectField, TextAreaField, TextField } from "./SettingsControls";

const POSITIONS: Record<ZoneKey, { position: string; meaning: string }> = {
  topLeft: { position: "Top left", meaning: "high on the vertical skill, lower on the horizontal one" },
  topRight: { position: "Top right", meaning: "high on both skills" },
  bottomLeft: { position: "Bottom left", meaning: "lower on both skills" },
  bottomRight: { position: "Bottom right", meaning: "high on the horizontal skill, lower on the vertical one" },
};

/** A starting point for a new zone map: the first two skills, a threshold of 65 and neutral names. */
export function defaultZoneMap(skills: Skill[]): ZoneMapConfig {
  const [horizontal, vertical] = skills;
  return {
    xSkillId: horizontal.id,
    ySkillId: vertical.id,
    threshold: 65,
    zones: {
      topRight: { label: "Strong on both", description: "" },
      topLeft: { label: `Strong on ${vertical.name || "the vertical skill"}`, description: "" },
      bottomRight: { label: `Strong on ${horizontal.name || "the horizontal skill"}`, description: "" },
      bottomLeft: { label: "Still building", description: "" },
    },
  };
}

/** Adds a "zone map" result section when a zone map is first set up, and removes it with the map. */
export function withZoneMap(definition: AssessmentDefinition, zoneMap: ZoneMapConfig | undefined, newId: (prefix: string) => string): AssessmentDefinition {
  const components = definition.results.components;
  if (!zoneMap) {
    return {
      ...definition,
      scoring: { ...definition.scoring, zoneMap: undefined },
      results: { ...definition.results, components: components.filter((c) => c.type !== "zone_map") },
    };
  }
  const shown = components.some((c) => c.type === "zone_map");
  return {
    ...definition,
    scoring: { ...definition.scoring, zoneMap },
    results: {
      ...definition.results,
      components: shown ? components : [{ id: newId("rc"), type: "zone_map", enabled: true, title: "Your map" }, ...components],
    },
  };
}

/**
 * Settings of the zone map: which two skills it plots, where "high" starts, and the name and meaning of
 * each of its four zones. It is shown by a "Zone map" result section.
 */
export function AdminZoneMapEditor({
  skills,
  zoneMap,
  onChange,
}: {
  skills: Skill[];
  zoneMap: ZoneMapConfig | undefined;
  onChange: (zoneMap: ZoneMapConfig | undefined) => void;
}) {
  if (!zoneMap) {
    return (
      <Panel
        title="Zone map"
        description="Plots two skills against each other (for example warmth and competence) and places the participant in one of four zones, each with its own name and explanation."
      >
        <div>
          <button type="button" className="btn-outline px-4 py-2 text-sm" disabled={skills.length < 2} onClick={() => onChange(defaultZoneMap(skills))}>
            Add a zone map
          </button>
        </div>
        {skills.length < 2 && <p className="text-sm text-ink-soft">A zone map needs at least two skills (see the Scoring tab).</p>}
      </Panel>
    );
  }

  const set = (patch: Partial<ZoneMapConfig>) => onChange({ ...zoneMap, ...patch });
  const setZone = (key: ZoneKey, patch: Partial<ZoneMapConfig["zones"][ZoneKey]>) => onChange({ ...zoneMap, zones: { ...zoneMap.zones, [key]: { ...zoneMap.zones[key], ...patch } } });
  const options = skills.map((s) => ({ value: s.id, label: s.name || "Unnamed skill" }));
  const missing = (id: string) => !skills.some((s) => s.id === id);
  const withMissing = (id: string) => (missing(id) ? [{ value: id, label: "(missing skill)" }, ...options] : options);

  return (
    <Panel
      title="Zone map"
      description="A skill score from “High from” up counts as high on that side. The map itself is shown by the “Zone map” section above."
      actions={
        <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => onChange(undefined)}>
          Remove the zone map
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Horizontal axis skill" value={zoneMap.xSkillId} options={withMissing(zoneMap.xSkillId)} onChange={(xSkillId) => set({ xSkillId })} />
        <SelectField label="Vertical axis skill" value={zoneMap.ySkillId} options={withMissing(zoneMap.ySkillId)} onChange={(ySkillId) => set({ ySkillId })} />
        <NumberField label="High from (1–99)" value={zoneMap.threshold} min={1} max={99} onChange={(threshold) => set({ threshold })} help="65 of 100 is about 3.6 on a 1–5 scale." />
        <TextField label="Horizontal axis name" value={zoneMap.xLabel ?? ""} optional maxLength={40} help="Default: the skill's name." onChange={(xLabel) => set({ xLabel: xLabel || undefined })} />
        <TextField label="Vertical axis name" value={zoneMap.yLabel ?? ""} optional maxLength={40} help="Default: the skill's name." onChange={(yLabel) => set({ yLabel: yLabel || undefined })} />
      </div>
      {zoneMap.xSkillId === zoneMap.ySkillId && <Alert tone="error">Choose two different skills for the two axes.</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {ZONE_KEYS.map((key) => (
          <fieldset key={key} className="space-y-3 rounded-2xl border border-primary/15 bg-surface-soft/30 p-4">
            <legend className="px-1 text-sm font-semibold text-primary-dark">
              {POSITIONS[key].position}: <span className="font-normal text-ink-soft">{POSITIONS[key].meaning}</span>
            </legend>
            <TextField label="Zone name" value={zoneMap.zones[key].label} maxLength={60} onChange={(label) => setZone(key, { label })} />
            <TextAreaField label="What it means for the participant" value={zoneMap.zones[key].description} rows={4} maxLength={600} onChange={(description) => setZone(key, { description })} />
          </fieldset>
        ))}
      </div>
    </Panel>
  );
}
