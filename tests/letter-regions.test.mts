import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { QuizItem } from '../src/types.ts';
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.yaml')) return { format: 'module', source: `export default ${JSON.stringify(parse(readFileSync(new URL(url), 'utf8')))};`, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { applyLetterRegions } = await import('../src/letter-regions.ts');
hooks.deregister();
const items = parse(readFileSync('data/items.yaml', 'utf8')).items as QuizItem[];
const base = items.find(i => i.id === 'first-line-gamma-epsilon-iota-nu')!;

test('Source letter positions survive an unchanged recall and an altered view with the same reference', () => {
  const original = applyLetterRegions(base);
  assert.equal(original.letter_regions?.length, 4);
  assert.deepEqual(applyLetterRegions({ ...base, id: 'recall-example', base_item: base.id }).letter_regions, original.letter_regions);
  assert.deepEqual(applyLetterRegions({ ...base, id: 'altered-example', base_item: base.id, image: 'altered.webp', reference_image: base.image, simulated: true }).letter_regions, original.letter_regions);
  assert.equal(base.letter_regions, undefined, 'source records are not mutated');
});

test('Changed readings, image files and crop coordinates cannot silently reuse old letter positions', () => {
  assert.throws(() => applyLetterRegions({ ...base, truth: 'ΑΒΓΔ' }), /reading mismatch/);
  assert.throws(() => applyLetterRegions({ ...base, image: 'different.webp' }), /image mismatch/);
  assert.throws(() => applyLetterRegions({ ...base, source_crop: [0, 0, 100, 100] }), /crop mismatch/);
  assert.equal(applyLetterRegions({ ...base, id: 'unknown-region', base_item: undefined, image: 'unknown.webp' }).letter_regions, undefined);
});
