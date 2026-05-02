/**
 * Classify a Gremlin chaos-pass output into structured categories.
 *
 * The Gremlin produces a numbered list of attacks / defects or the sentinel
 * "NO DEFECTS FOUND".  This module parses that into machine-readable form so
 * the Troll can make an informed decision rather than treating the raw text
 * as undifferentiated "evidence against passing".
 */

export type DefectSeverity = "critical" | "major" | "minor" | "nitpick";

export interface ClassifiedDefect {
  /** 1-indexed position in the Gremlin's list. */
  index: number;
  /** Raw text of this attack line. */
  text: string;
  severity: DefectSeverity;
}

export interface ChaosClassification {
  /** True when the Gremlin explicitly found nothing wrong. */
  noDefectsFound: boolean;
  defects: ClassifiedDefect[];
  /** Summary counts by severity. */
  counts: Record<DefectSeverity, number>;
  /** Single number 0-1 representing overall severity (higher = worse output). */
  severityScore: number;
}

const NO_DEFECT_RE = /no\s+defects?\s+found/i;

/**
 * Heuristic severity keywords.  We scan each attack line for these phrases
 * and pick the highest-severity match.  If nothing matches, default to "nitpick".
 */
const SEVERITY_SIGNALS: Array<{ re: RegExp; severity: DefectSeverity }> = [
  // critical
  { re: /\bsecurity\b/i, severity: "critical" },
  { re: /\binjection\b/i, severity: "critical" },
  { re: /\bdata\s*loss\b/i, severity: "critical" },
  { re: /\bcorrupt/i, severity: "critical" },
  { re: /\bcrash/i, severity: "critical" },
  { re: /\bundefined\s+behavio/i, severity: "critical" },
  { re: /\brace\s+condition/i, severity: "critical" },
  // major
  { re: /\bincorrect\b/i, severity: "major" },
  { re: /\bwrong\b/i, severity: "major" },
  { re: /\bbug\b/i, severity: "major" },
  { re: /\bfail/i, severity: "major" },
  { re: /\berror\b/i, severity: "major" },
  { re: /\bmissing\b/i, severity: "major" },
  { re: /\boff-by-one/i, severity: "major" },
  { re: /\bedge\s*case/i, severity: "major" },
  { re: /\bboundary/i, severity: "major" },
  // minor
  { re: /\bperformance\b/i, severity: "minor" },
  { re: /\bverbose\b/i, severity: "minor" },
  { re: /\bredundant\b/i, severity: "minor" },
  { re: /\bincomplete\b/i, severity: "minor" },
  // nitpick
  { re: /\bstyle\b/i, severity: "nitpick" },
  { re: /\bnaming\b/i, severity: "nitpick" },
  { re: /\bformat/i, severity: "nitpick" },
  { re: /\bnitpick/i, severity: "nitpick" },
  { re: /\bwhitespace/i, severity: "nitpick" },
];

const SEVERITY_WEIGHTS: Record<DefectSeverity, number> = {
  critical: 1.0,
  major: 0.6,
  minor: 0.25,
  nitpick: 0.08,
};

/** Order for comparison: higher ordinal = more severe. */
const SEVERITY_ORDER: Record<DefectSeverity, number> = {
  nitpick: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

function classifySeverity(line: string): DefectSeverity {
  let best: DefectSeverity = "nitpick";
  for (const { re, severity } of SEVERITY_SIGNALS) {
    if (re.test(line) && SEVERITY_ORDER[severity] > SEVERITY_ORDER[best]) {
      best = severity;
    }
  }
  return best;
}

/**
 * Parse the Gremlin's raw output into structured categories.
 *
 * Accepts both numbered lists (`1. ...`, `1) ...`) and bullet lists (`- ...`).
 * Falls back to splitting on blank lines if no list markers are found.
 */
export function classifyChaos(gremlinOutput: string): ChaosClassification {
  if (NO_DEFECT_RE.test(gremlinOutput)) {
    return {
      noDefectsFound: true,
      defects: [],
      counts: { critical: 0, major: 0, minor: 0, nitpick: 0 },
      severityScore: 0,
    };
  }

  const lines = extractListItems(gremlinOutput);
  const defects: ClassifiedDefect[] = lines.map((text, i) => ({
    index: i + 1,
    text,
    severity: classifySeverity(text),
  }));

  const counts: Record<DefectSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    nitpick: 0,
  };
  for (const d of defects) counts[d.severity]++;

  // Severity score: weighted sum of defects, capped at 1.
  const raw = defects.reduce(
    (sum, d) => sum + SEVERITY_WEIGHTS[d.severity],
    0,
  );
  const severityScore = Math.min(1, raw / 3); // 3 major-equivalents = max

  return { noDefectsFound: false, defects, counts, severityScore };
}

/**
 * Build a concise structured summary for the Troll prompt.
 */
export function chaosSummaryForTroll(cls: ChaosClassification): string {
  if (cls.noDefectsFound) {
    return "Gremlin audit: NO DEFECTS FOUND. The Gremlin could not break this output.";
  }
  const parts: string[] = [
    `Gremlin audit: ${cls.defects.length} finding(s) — ` +
      `${cls.counts.critical} critical, ${cls.counts.major} major, ` +
      `${cls.counts.minor} minor, ${cls.counts.nitpick} nitpick. ` +
      `Severity score: ${cls.severityScore.toFixed(2)}/1.00.`,
  ];
  // Include the top 5 most severe findings verbatim.
  const sorted = [...cls.defects].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  );
  const top = sorted.slice(0, 5);
  for (const d of top) {
    parts.push(`  [${d.severity.toUpperCase()}] ${d.text}`);
  }
  if (sorted.length > 5) {
    parts.push(`  ... and ${sorted.length - 5} more.`);
  }
  return parts.join("\n");
}

// --- internal helpers ---

function extractListItems(text: string): string[] {
  // Try numbered list first: "1. ...", "1) ...", "1: ..."
  const numbered = text.match(/^\s*\d+[.):\-]\s+.+$/gm);
  if (numbered && numbered.length >= 2) {
    return numbered.map((l) => l.replace(/^\s*\d+[.):\-]\s+/, "").trim());
  }
  // Try bullet list: "- ...", "* ..."
  const bullets = text.match(/^\s*[-*•]\s+.+$/gm);
  if (bullets && bullets.length >= 2) {
    return bullets.map((l) => l.replace(/^\s*[-*•]\s+/, "").trim());
  }
  // Fallback: split on double-newline or single newline with substance
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (paragraphs.length >= 2) return paragraphs;
  // Last resort: treat the whole thing as one finding
  const trimmed = text.trim();
  return trimmed.length > 0 ? [trimmed] : [];
}
