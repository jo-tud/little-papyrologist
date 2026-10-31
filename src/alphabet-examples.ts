import type { QuizItem } from "./types";

export interface AlphabetExample {
  itemId: string;
  description: string;
  study?: boolean;
}

/** Existing checked regions only; neighbouring letters stay in their published groups. */
export const alphabetExamples: Record<string, AlphabetExample[]> = {
  Ε: [
    { itemId: "photo-248-epsilon", description: "The open curve and middle stroke belong to Epsilon. Its back is rounded, unlike printed Ε." },
    { itemId: "first-line-epsilon", description: "Another Epsilon, from inside a rolled scroll. The edition identifies this letter; the image shows the curved back and middle stroke." },
  ],
  Η: [
    { itemId: "first-line-extra-l12-eta", description: "The published reading identifies Eta. Its linked uprights have unequal proportions, with an extended foot on the right." },
    { itemId: "first-line-extra-l16-eta", description: "Eta in another line of the same column. The linking stroke and both uprights belong to one letter." },
    { itemId: "photo-500p2-eta", study: true, description: "A less familiar Eta, named by the source. The connecting stroke sits high, and the right upright extends only a little above it. The photo does not establish why that stroke is short." },
  ],
  Ι: [
    { itemId: "first-line-extra-l05-iota", description: "Iota: one upright from the beginning of a word in the published reading." },
    { itemId: "first-line-extra-l08-iota", description: "Iota in another line, with a thicker lower end. The word continues on the following line." },
    { itemId: "first-line-extra-l12-iota", description: "This Iota has a broad foot. It is part of the letter's handwritten form, not an extra character." },
  ],
  Ν: [
    { itemId: "first-line-extra-l05-nu", description: "Nu: two uprights joined by a sloping stroke, identified in the published reading." },
    { itemId: "photo-500p2-nu2", study: true, description: "The organizers identify this photographed sample as Nu. Its angles and stroke lengths differ from the printed form." },
    { itemId: "photo-500p2-nu", study: true, description: "Another sample identified as Nu, with a much flatter linking stroke. A confirmed reading can still be hard to recognize in isolation." },
  ],
  Ο: [
    { itemId: "photo-250-omicron", description: "Omicron: follow the main closed loop. Its outline is uneven, with small projecting marks; it need not be a perfect printed Ο." },
  ],
  Ρ: [
    { itemId: "photo-250-rho", study: true, description: "A source-labelled Rho with an interrupted outline. The main shape has a rounded head and a stroke extending below it. This is a study example, not a neat model of the letter." },
  ],
  Γ: [
    { itemId: "first-line-gamma-epsilon", description: "Gamma is the first letter in ΓΕ (Gamma–Epsilon). Its lower end curls. These are the opening letters of a word, not a word on their own." },
  ],
  Λ: [
    { itemId: "first-line-pi-lambda-eta", study: true, description: "Lambda is the middle letter in ΠΛΗ (Pi–Lambda–Eta), according to the edition. The strokes at the left run together, so we keep the whole group visible. The word continues on the next line." },
  ],
  Π: [
    { itemId: "first-line-pi-lambda-eta", study: true, description: "Pi is the first letter in ΠΛΗ (Pi–Lambda–Eta), according to the edition. The connected strokes do not separate as neatly as printed letters; compare this as a group." },
  ],
  Τ: [
    { itemId: "photo-500p2-iota-tau", description: "Tau is the right-hand letter in the named pair ΙΤ (Iota–Tau). It has an upright and a top bar. The single upright on the left is Iota." },
  ],
};

/** Refuse missing, uncertain or artificially altered material in this reference. */
export function resolveAlphabetExamples(items: QuizItem[]): Map<string, (AlphabetExample & { item: QuizItem })[]> {
  const byId = new Map(items.map(item => [item.id, item]));
  return new Map(Object.entries(alphabetExamples).map(([char, examples]) => [char, examples.map(example => {
    const item = byId.get(example.itemId);
    if (!item || item.degradation !== 0 || item.simulated || item.uncertain?.length || !item.truth.includes(char)
      || !item.checked || !item.source.length || !item.license || !item.credit) {
      throw new Error(`Invalid alphabet example: ${example.itemId}`);
    }
    return { ...example, item };
  })]));
}
