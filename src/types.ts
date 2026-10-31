export interface Glyph {
  char: string;
  name: string;
  latin: string;
  strokes: Record<string, string>;
  look_for: string;
}

export interface Source {
  id: string;
  title: string;
  url?: string;
  kind: string;
  note?: string;
  checked: string;
}

export interface Fact {
  id: string;
  title: string;
  text: string;
  quote?: string;
  sources: string[];
}

export interface Group {
  id: string;
  title: string;
  letters: string[];
  intro: string;
  sources?: string[];
}

export type NullKind = "fibres" | "streaks" | "crack" | "blot" | "shuffle";

/** [letter, stroke, dx, dy, rotation in degrees] */
export type Piece = [string, string, number, number, number];

export interface Draw {
  letter?: string;
  hide?: string[];
  empty?: NullKind;
  pieces?: Piece[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Drill {
  id: string;
  group: string;
  draw: Draw;
  damage?: Box[];
  truth: string; // a letter, "?" or "none"
  candidates?: string[];
  explain: string;
  sources?: string[];
}

export interface Hero {
  /** An existing source-backed image item, reused without changing its reading or credits. */
  item: string;
  where: string;
  note: string;
}

export interface QuizItem {
  id: string;
  /** Items with the same set are played together. */
  set: string;
  level: number;
  degradation: number;
  image: string;
  /** Optional second image shown with the answer, e.g. the organizers' ink tracing. */
  answer_image?: string;
  /** Unchanged source, shown only after answering an altered image. */
  reference_image?: string;
  reference_answer_image?: string;
  base_item?: string;
  simulated?: boolean;
  degradation_recipe?: Record<string, unknown>;
  /** Extra practice does not add a required step to the path. */
  practice_only?: boolean;
  /** A lesson can finish without answering this challenge. */
  optional_challenge?: boolean;
  /** Related short readings available as a focused practice round. */
  practice_group?: string;
  /** Optional reading guide; using it is recorded separately. */
  guide?: string;
  assisted?: boolean;
  edition_indices?: [number, number];
  source_crop?: [number, number, number, number];
  alt: string;
  /** Capitals as read; "*" = ink present, letters not confirmed; "none" = no text. */
  truth: string;
  /** The edition's own text for this line, with accents and dots below. */
  edition?: string;
  /** "study" is a labelled example, without an answer or score. */
  task: "read" | "detect" | "identify" | "study";
  choices?: string[];
  hint?: string;
  question?: string;
  preparation?: string;
  stage?: string;
  compare_with?: string;
  /** Original identifier in the published dataset, separate from the displayed reading. */
  sample_id?: string;
  uncertain?: number[];
  reading?: string;
  source: string[];
  license: string;
  /** Credit line shown with the image (see LICENSES.md). */
  credit: string;
  changes?: string;
  checked: string;
  explain: string;
}

/** What the player said about one tile. */
export type SaidText = "yes" | "no" | "unsure";

/** null means confidence was not asked; it must not be treated as a rating. */
export type Confidence = 1 | 2 | 3 | null;

export interface AnswerRecord {
  item_id: string;
  /** Kept in exports so assisted recognition can be separated from transcription. */
  task?: "drawn" | Exclude<QuizItem["task"], "study">;
  practice?: boolean;
  help_used?: boolean;
  base_item?: string;
  simulated?: boolean;
  level: number;
  degradation: number;
  said_text: SaidText;
  letters: string; // "" when no letters were given; "?" marks an unreadable letter
  confidence: Confidence;
  ms: number;
  answered_at: string;
  truth: string;
  text_correct: boolean;
  letters_correct: boolean | null; // null when there were no letters to read
  /** right | honest | careful | guessed | false-alarm | missed | wrong (see scoring.ts) */
  verdict: string;
  /** For lines: letters read correctly and the length of the reading. */
  letters_ok?: number;
  letters_total?: number;
  reading_points: number;
  honesty_points: number;
}

export interface QuizSet {
  id: string;
  level: number;
  title: string;
  ordered?: boolean;
  intro?: string;
  practice_only?: boolean;
}

export interface PlaySet {
  id: string;
  level: number;
  title: string;
  href: string;
}

export interface BadgeDef {
  id: string;
  title: string;
  how: string;
  requires: import("./rules").Requirements;
}

export interface RankDef {
  id: string;
  title: string;
  blurb: string;
  /** Shown as "???" until reached. */
  secret?: boolean;
  sources?: string[];
  requires: import("./rules").Requirements;
}
