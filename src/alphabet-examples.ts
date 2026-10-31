import type { QuizItem } from "./types";
import referenceData from "../data/alphabet-items.yaml";
import { applyLetterRegions } from "./letter-regions";

export interface AlphabetExample {
  itemId: string;
  description: string;
  study?: boolean;
  partial?: boolean;
}

/** Existing checked regions only; neighbouring letters stay in their published groups. */
export const alphabetExamples: Record<string, AlphabetExample[]> = {
  Α: [
    { itemId: "alphabet-paris4-12-kai", description: "Alpha is the middle letter in ΚΑΙ (Kappa–Alpha–Iota). The letters touch, so we keep the group together." },
    { itemId: "alphabet-paris4-8-nu-to-iota", study: true, description: "Alpha is fifth in ΝΕϹΘΑΙ, just before the final Iota. The fainter neighbours need the published reading." },
  ],
  Δ: [
    { itemId: "photo-250-delta", study: true, partial: true, description: "A source-labelled Delta. The triangular opening survives, while the top and lower stroke ends fall outside the photograph." },
  ],
  Ε: [
    { itemId: "photo-248-epsilon", description: "The open curve and middle stroke belong to Epsilon. Its back is rounded, unlike printed Ε." },
    { itemId: "first-line-epsilon", description: "Another Epsilon, from inside a rolled scroll. The edition identifies this letter; the image shows the curved back and middle stroke." },
  ],
  Η: [
    { itemId: "first-line-extra-l12-eta", description: "The published reading identifies Eta. Its linked uprights have unequal proportions, with an extended foot on the right." },
    { itemId: "first-line-extra-l16-eta", description: "Eta in another line of the same column. The linking stroke and both uprights belong to one letter." },
    { itemId: "photo-500p2-eta", study: true, description: "A less familiar Eta, named by the source. The connecting stroke sits high, and the right upright extends only a little above it. The photo does not establish why that stroke is short." },
    { itemId: "alphabet-paris4-12-eta-mu-iota-nu", description: "Eta is first in ΗΜΙΝ (Eta–Mu–Iota–Nu), in a different column of the same scroll." },
  ],
  Θ: [
    { itemId: "alphabet-paris4-8-nu-to-iota", study: true, description: "Theta is fourth in ΝΕϹΘΑΙ. Its strokes are faint here; the edition provides the identification. Keep the neighbouring letters in view." },
  ],
  Ι: [
    { itemId: "first-line-extra-l05-iota", description: "Iota: one upright from the beginning of a word in the published reading." },
    { itemId: "first-line-extra-l08-iota", description: "Iota in another line, with a thicker lower end. The word continues on the following line." },
    { itemId: "first-line-extra-l12-iota", description: "This Iota has a broad foot. It is part of the letter's handwritten form, not an extra character." },
    { itemId: "first-line-extra-l16-iota", study: true, description: "Another Iota, with curled ends. The published reading identifies the whole narrow shape as one letter." },
    { itemId: "alphabet-paris4-12-kai", description: "Iota is the final letter in ΚΑΙ. Its broad foot differs from the simple upright in other examples." },
  ],
  Κ: [
    { itemId: "alphabet-paris4-12-kai", description: "Kappa is first in ΚΑΙ. Compare its upright and the two branches with printed Κ." },
    { itemId: "photo-250-kappa", study: true, partial: true, description: "A source-labelled Kappa with some stroke ends outside the photograph. The tracing marks the ink that is visible." },
  ],
  Μ: [
    { itemId: "alphabet-paris4-12-eta-mu-iota-nu", description: "Mu is the second letter in ΗΜΙΝ. Compare it with the Nu at the right; the intervening narrow letter is Iota." },
  ],
  Ν: [
    { itemId: "first-line-extra-l05-nu", description: "Nu: two uprights joined by a sloping stroke, identified in the published reading." },
    { itemId: "photo-500p2-nu2", study: true, description: "The organizers identify this photographed sample as Nu. Its angles and stroke lengths differ from the printed form." },
    { itemId: "photo-500p2-nu", study: true, description: "Another sample identified as Nu, with a much flatter linking stroke. A confirmed reading can still be hard to recognize in isolation." },
    { itemId: "photo-248-nu", study: true, description: "A Nu from another papyrus, named by the source. The visible strokes do not give the uninterrupted outline of printed Ν." },
    { itemId: "alphabet-paris4-12-ton", description: "Nu is the last letter in ΤΩΝ (Tau–Omega–Nu), with a broad diagonal link." },
  ],
  Ο: [
    { itemId: "photo-250-omicron", description: "Omicron: follow the main closed loop. Its outline is uneven, with small projecting marks; it need not be a perfect printed Ο." },
  ],
  Ρ: [
    { itemId: "photo-250-rho", study: true, description: "A source-labelled Rho with an interrupted outline. The main shape has a rounded head and a stroke extending below it. This is a study example, not a neat model of the letter." },
  ],
  Γ: [
    { itemId: "first-line-gamma-epsilon", description: "Gamma is the first letter in ΓΕ (Gamma–Epsilon). Its lower end curls. These are the opening letters of a word, not a word on their own." },
    { itemId: "first-line-gamma-epsilon-iota-nu", description: "Gamma is first in ΓΕΙΝ, the beginning of a word. See the same letter with more of its neighbours." },
  ],
  Λ: [
    { itemId: "first-line-pi-lambda-eta", study: true, description: "Lambda is the middle letter in ΠΛΗ (Pi–Lambda–Eta), according to the edition. The strokes at the left run together, so we keep the whole group visible. The word continues on the next line." },
    { itemId: "photo-248-lambda", study: true, partial: true, description: "A source-labelled Lambda with unfamiliar proportions. The long left stroke reaches the photograph's lower edge." },
  ],
  Π: [
    { itemId: "first-line-pi-lambda-eta", study: true, description: "Pi is the first letter in ΠΛΗ (Pi–Lambda–Eta), according to the edition. The connected strokes do not separate as neatly as printed letters; compare this as a group." },
    { itemId: "photo-248-pi", study: true, partial: true, description: "A source-labelled Pi. Several strokes run beyond the photograph's edges; this is only part of its outline." },
  ],
  Ϲ: [
    { itemId: "photo-250-sigma", partial: true, description: "Sigma has a rounded form, Ϲ, unlike printed Σ. The photograph cuts into the left of its curve." },
    { itemId: "alphabet-paris4-8-nu-to-iota", study: true, description: "Sigma is third in ΝΕϹΘΑΙ, between Epsilon and Theta. Its strokes are fainter than in the photograph." },
  ],
  Τ: [
    { itemId: "photo-500p2-iota-tau", description: "Tau is the right-hand letter in the named pair ΙΤ (Iota–Tau). It has an upright and a top bar. The single upright on the left is Iota." },
    { itemId: "alphabet-paris4-12-ton", description: "Tau is first in ΤΩΝ (Tau–Omega–Nu). Its wide top bar has a projecting end." },
  ],
  Υ: [
    { itemId: "alphabet-paris4-12-phi-upsilon-rho", description: "Upsilon is the middle letter in ΦΥΡ. Here its top is broad and shallow, unlike printed Υ." },
  ],
  Φ: [
    { itemId: "alphabet-paris4-12-phi-upsilon-rho", description: "Phi is first in ΦΥΡ. Its loop is crossed by an upright; the group comes from the word for purple." },
    { itemId: "photo-248-phi", partial: true, description: "A source-labelled Phi from an opened papyrus. The photograph cuts off part of the loop and upright at its edges." },
  ],
  Ω: [
    { itemId: "alphabet-paris4-12-ton", description: "Omega is the middle letter in ΤΩΝ. Its rounded strokes are open at the top, unlike the closed loop of Omicron." },
  ],
};

/** Refuse missing, uncertain or artificially altered material in this reference. */
export function resolveAlphabetExamples(items: QuizItem[]): Map<string, (AlphabetExample & { item: QuizItem })[]> {
  const references = (referenceData as { items: QuizItem[] }).items;
  const byId = new Map([...items, ...references].map(item => [item.id, item]));
  return new Map(Object.entries(alphabetExamples).map(([char, examples]) => [char, examples.map(example => {
      const item = byId.get(example.itemId);
    if (!item || item.degradation !== 0 || item.simulated || item.uncertain?.length || !item.truth.includes(char)
      || !item.checked || !item.source.length || !item.license || !item.credit) {
      throw new Error(`Invalid alphabet example: ${example.itemId}`);
    }
    return { ...example, item: applyLetterRegions(item) };
  })]));
}
