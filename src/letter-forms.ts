import formData from "../data/letter-forms.yaml";
import { glyphByChar } from "./data";
import { letterName } from "./ui";
import { esc } from "./util";
import "./letter-forms.css";

interface Form { char: string; example: string; label: string; paths: string[]; sources: string[] }
const alternate = new Map((formData as { forms: Form[] }).forms.map(form => [form.char, form]));

/** Shape aids are simplified references, not tracings of the question image. */
export function letterFormLabel(char: string): string {
  const glyph = glyphByChar.get(char);
  if (!glyph) return esc(char);
  const extra = alternate.get(char);
  const drawings = [Object.values(glyph.strokes), ...(extra ? [extra.paths] : [])];
  const shapes = drawings.map(paths => `<svg viewBox="0 0 100 130" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${paths.map(path => `<path d="${esc(path)}"/>`).join("")}</g></svg>`).join("");
  return `<span class="letter-form-label"><span class="letter-form-shapes" aria-hidden="true">${shapes}</span>
    <span class="greek form-print" lang="grc" aria-hidden="true">${char === "Ϲ" ? "Σ" : esc(char)}</span>
    <span class="letter-name">${esc(letterName(char))}</span></span>`;
}
