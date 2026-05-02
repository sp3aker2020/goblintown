import { makeGoblin } from "./creatures.js";
import { measureDrift } from "./drift.js";
import { callCreature } from "./openai-client.js";
import type { Loot, Personality } from "./types.js";
import type { Hoard } from "./hoard.js";

export interface ReviseOptions {
  goblinLoot: Loot;
  chaosLoot: Loot;
  originalTask: string;
  hoard: Hoard;
  personality?: Personality;
  riteId?: string;
  revisionIndex: number;
}

export async function reviseGoblin(opts: ReviseOptions): Promise<Loot> {
  // Use the same personality, but the prompt makes it clear they are revising.
  const goblin = makeGoblin(opts.personality, "worker"); // Keep it a worker so it doesn't try to change the approach, just fix bugs.
  
  const userPrompt =
    `Original task:\n${opts.originalTask}\n\n` +
    `Your previous draft:\n${opts.goblinLoot.output}\n\n` +
    `An auditor reviewed your draft and provided the following feedback:\n${opts.chaosLoot.output}\n\n` +
    `Please revise your draft to address the auditor's feedback while still fulfilling the original task. ` +
    `If the auditor found no defects, you may return your original draft unmodified, or make minor polish improvements. ` +
    `Provide only the revised artifact with no preamble.`;

  const { text: output, usage } = await callCreature(goblin, userPrompt);
  const drift = measureDrift(output);
  const loot: Loot = {
    id: "",
    riteId: opts.riteId,
    creatureKind: "goblin",
    personality: goblin.personality,
    model: goblin.model,
    prompt: userPrompt,
    output,
    parentLootIds: [opts.goblinLoot.id, opts.chaosLoot.id],
    timestamp: Date.now(),
    drift,
    usage,
  };
  await opts.hoard.stash(loot);
  return loot;
}
