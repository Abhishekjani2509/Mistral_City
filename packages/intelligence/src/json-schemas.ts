const finding = {
  type: "object", additionalProperties: false,
  required: ["id", "type", "technicalDescription", "file", "line", "evidence", "severity", "confidence"],
  properties: {
    id: { type: "string" }, type: { type: "string" }, technicalDescription: { type: "string" }, file: { type: "string" },
    line: { type: "integer", minimum: 1 }, evidence: { type: "string" }, severity: { enum: ["info", "minor", "major", "critical"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const grade = (tiers: string[]) => ({
  type: "object", additionalProperties: false, required: ["tier", "confidence", "rationale", "findings"],
  properties: { tier: { enum: tiers }, confidence: { type: "number", minimum: 0, maximum: 1 }, rationale: { type: "string" }, findings: { type: "array", maxItems: 12, items: finding } },
});

export const discoveryJsonSchema = {
  type: "object", additionalProperties: false, required: ["systems"],
  properties: { systems: { type: "array", minItems: 3, maxItems: 20, items: {
    type: "object", additionalProperties: false,
    required: ["id", "name", "plainDescription", "buildingType", "files", "connections", "discoveryConfidence"],
    properties: {
      id: { type: "string" }, name: { type: "string" }, plainDescription: { type: "string" },
      buildingType: { enum: ["tower", "gate", "vault", "workshop", "district", "library", "port", "depot", "guard_tower"] },
      files: { type: "array", items: { type: "string" } }, connections: { type: "array", items: { type: "string" } },
      discoveryConfidence: { type: "number", minimum: 0, maximum: 1 },
    },
  } } },
} as const;

export const codeGradesJsonSchema = {
  type: "object", additionalProperties: false, required: ["security", "scalability", "modularity"],
  properties: {
    security: grade(["fortified", "breachable", "undefended"]),
    scalability: grade(["load_bearing", "strained", "buckling"]),
    modularity: grade(["well_walled", "tangled", "labyrinth"]),
  },
} as const;

export const deploymentGradeJsonSchema = grade(["forged", "sputtering", "cold_forge"]);

export const fastQualityGradesJsonSchema = {
  type: "object", additionalProperties: false, required: ["security", "scalability", "deployment", "modularity"],
  properties: {
    security: grade(["fortified", "breachable", "undefended"]),
    scalability: grade(["load_bearing", "strained", "buckling"]),
    deployment: grade(["forged", "sputtering", "cold_forge"]),
    modularity: grade(["well_walled", "tangled", "labyrinth"]),
  },
} as const;

export const plainJsonSchema = {
  type: "object", additionalProperties: false, required: ["issues"],
  properties: { issues: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "plainDescription"], properties: { id: { type: "string" }, plainDescription: { type: "string" } } } } },
} as const;

export const guardJsonSchema = {
  type: "object", additionalProperties: false, required: ["gaps"],
  properties: { gaps: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["behaviour", "whyItMatters", "suggestedTestName", "files", "priority", "blastRadius"], properties: {
    behaviour: { type: "string" }, whyItMatters: { type: "string" }, suggestedTestName: { type: "string" }, files: { type: "array", items: { type: "string" } },
    priority: { type: "integer", minimum: 1, maximum: 5 }, blastRadius: { type: "number", minimum: 0, maximum: 1 },
  } } } },
} as const;
