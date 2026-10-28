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
  line: string;
  words: string[];
  edition: string;
  where: string;
  note: string;
  gloss: string;
  sources: string[];
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
  alt: string;
  /** Capitals as read; "*" = ink present, letters not confirmed; "none" = no text. */
  truth: string;
  /** The edition's own text for this line, with accents and dots below. */
  edition?: string;
  /** "read": read the letters (scored); "detect": is there writing at all? */
  task: "read" | "detect" | "identify";
  choices?: string[];
  hint?: string;
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

export interface AnswerRecord {
  item_id: string;
  /** Kept in exports so assisted recognition can be separated from transcription. */
  task?: "drawn" | QuizItem["task"];
  level: number;
  degradation: number;
  said_text: SaidText;
  letters: string; // "" when no letters were given; "?" marks an unreadable letter
  confidence: 1 | 2 | 3;
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
