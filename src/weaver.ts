import { makeGoblin } from "./creatures.js";
import { measureDrift } from "./drift.js";
import { callCreature } from "./openai-client.js";
import type { Loot, Personality, TrollVerdict } from "./types.js";
import type { Hoard } from "./hoard.js";

export interface SynthesizePackOptions {
  failedDrafts: Loot[];
  trollVerdicts: Record<string, TrollVerdict>;
  originalTask: string;
  hoard: Hoard;
  personality?: Personality;
  riteId?: string;
}

export async function synthesizePack(opts: SynthesizePackOptions): Promise<Loot> {
  // A Weaver is just a Goblin taking on a synthesis role.
  // We use the 'worker' variant so it focuses purely on the provided instructions.
  const weaver = makeGoblin(opts.personality, "worker");

  let inputContext = "";
  opts.failedDrafts.forEach((draft, index) => {
    const verdict = opts.trollVerdicts[draft.id];
    inputContext += `\n--- Draft ${index + 1} ---\n`;
    inputContext += `${draft.output}\n`;
    inputContext += `\n[Troll Critique for Draft ${index + 1}]:\n`;
    inputContext += `${verdict?.critique ?? "No critique provided."}\n`;
  });

  const userPrompt =
    `Original task:\n${opts.originalTask}\n\n` +
    `A pack of Goblins attempted this task, but all of their drafts were rejected by the Troll auditor. ` +
    `However, each draft might contain some good ideas or partially correct implementations.\n` +
    `Here are the failed drafts and the specific reasons they were rejected:\n` +
    `${inputContext}\n\n` +
    `Your job as the Weaver is to synthesize a single, unified "best-of" artifact that completely satisfies the original task. ` +
    `You must resolve all the flaws pointed out in the Troll critiques. Pick the best approaches from the drafts, or write new code if necessary to bridge the gaps. ` +
    `Provide only the synthesized artifact with no preamble.`;

  const { text: output, usage } = await callCreature(weaver, userPrompt);
  const drift = measureDrift(output);
  const loot: Loot = {
    id: "",
    riteId: opts.riteId,
    creatureKind: "goblin", // Weaver is conceptually a goblin
    personality: weaver.personality,
    model: weaver.model,
    prompt: userPrompt,
    output,
    parentLootIds: opts.failedDrafts.map((d) => d.id),
    timestamp: Date.now(),
    drift,
    usage,
  };
  await opts.hoard.stash(loot);
  return loot;
}
