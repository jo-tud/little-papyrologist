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
  level: number;
  degradation: number;
  image: string;
  alt: string;
  truth: string;
  uncertain?: number[];
  reading?: string;
  source: string[];
  license: string;
  changes?: string;
  checked: string;
  explain: string;
}

/** What the player said about one tile. */
export type SaidText = "yes" | "no" | "unsure";

export interface AnswerRecord {
  item_id: string;
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
  reading_points: number;
  honesty_points: number;
}
