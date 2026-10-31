import regionData from "../data/letter-regions.yaml";
import type { QuizItem } from "./types";

interface RegionEntry {
  id: string;
  truth: string;
  image: string;
  source_crop?: QuizItem["source_crop"];
  regions: NonNullable<QuizItem["letter_regions"]>;
}
const regions = new Map((regionData as { items: RegionEntry[] }).items.map(entry => [entry.id, entry]));
const imageRegions = new Map([...regions.values()].map(entry => [`${entry.image}:${entry.truth}`, entry]));

/** Reuse coordinates only for the same reading and the same source crop. */
export function applyLetterRegions(item: QuizItem): QuizItem {
  const entry = regions.get(item.id) ?? (item.base_item ? regions.get(item.base_item) : undefined)
    ?? imageRegions.get(`${item.reference_image ?? item.image}:${item.truth}`);
  if (entry && entry.truth !== item.truth) throw new Error(`Letter region reading mismatch: ${item.id}`);
  if (entry && entry.image !== (item.reference_image ?? item.image)) throw new Error(`Letter region image mismatch: ${item.id}`);
  if (entry?.source_crop && item.source_crop && JSON.stringify(entry.source_crop) !== JSON.stringify(item.source_crop)) {
    throw new Error(`Letter region crop mismatch: ${item.id}`);
  }
  return entry ? { ...item, letter_regions: entry.regions } : item;
}
