import type { QuizItem } from "./types";
import { namedLetter } from "./ui";
import { esc } from "./util";
import "./task-viewer.css";

/** The image node survives checking an answer, including its zoom and scroll position. */
export function taskViewer(item: QuizItem, revealed: boolean): string {
  const reference = item.reference_image ?? item.answer_image;
  const label = item.simulated ? "Practice image" : "Original image";
  const referenceLabel = item.reference_image ? "Unchanged source" : "Ink tracing";
  const wide = (item.task === "read" || item.task === "study") && item.truth.length > 4;
  return `<section class="task-viewer${wide ? " viewer-wide" : ""}" data-mode="ab" data-view="original" aria-label="Papyrus image">
    <div class="viewer-images">
      <figure data-viewer-image="original"><div class="viewer-viewport" tabindex="0" role="region" aria-label="${label}; zoom for detail">
        <div class="viewer-canvas"><img src="images/${esc(item.image)}" alt="${esc(item.alt)}"><svg class="letter-overlay" aria-hidden="true"></svg></div></div></figure>
      ${reference ? `<figure data-viewer-image="reference" hidden><div class="viewer-viewport" tabindex="0" role="region" aria-label="${referenceLabel}; zoom for detail">
        <div class="viewer-canvas"><img src="images/${esc(reference)}" alt="${item.reference_image ? "Unchanged source for this practice image" : "The same photograph with the organizers' ink tracing in red"}"><svg class="letter-overlay" aria-hidden="true"></svg></div></div></figure>` : ""}
    </div>
    <div class="viewer-toolbar">
      <button type="button" class="linkish" data-viewer-zoom aria-pressed="false">Zoom in</button>
      ${reference ? `<div class="viewer-comparison" role="group" aria-label="Compare images" ${revealed ? "" : "hidden"}>
        <button type="button" data-viewer-view="original" aria-pressed="true">Image</button>
        <button type="button" data-viewer-view="reference" aria-pressed="false">${referenceLabel}</button>
        <button type="button" data-viewer-view="split" aria-pressed="false" aria-label="Show images side by side">A | B</button>
      </div>` : ""}
    </div>
    <p class="viewer-credit">${esc(item.credit)} · ${esc(item.license)}</p>
    ${item.letter_regions?.some(Boolean) ? `<p class="letter-location small" role="status" hidden></p>` : ""}
  </section>`;
}

/** Approximate source locations are distinct from the organizers' ink tracings. */
export function showLetterRegion(main: HTMLElement, item: QuizItem, index: number, pan = false): void {
  const region = item.letter_regions?.[index];
  if (!region) return;
  const viewer = main.querySelector<HTMLElement>(".task-viewer");
  if (!viewer) return;
  main.querySelectorAll<HTMLButtonElement>("[data-letter-index]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.letterIndex) === index)));
  const label = viewer.querySelector<HTMLElement>(".letter-location")!;
  label.hidden = false;
  label.textContent = `${namedLetter(Array.from(item.truth)[index])} · approximate ${item.simulated ? "source " : ""}letter area`;
  viewer.querySelectorAll<HTMLElement>(".viewer-canvas").forEach(canvas => {
    const img = canvas.querySelector<HTMLImageElement>("img")!;
    const svg = canvas.querySelector<SVGSVGElement>("svg")!;
    const draw = () => {
      if (!img.naturalWidth || !svg.isConnected) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.innerHTML = `<rect x="${region[0] * w}" y="${region[1] * h}" width="${(region[2] - region[0]) * w}" height="${(region[3] - region[1]) * h}" vector-effect="non-scaling-stroke" />`;
      if (pan && viewer.classList.contains("enlarged") && !canvas.closest<HTMLElement>("figure")!.hidden) {
        const viewport = canvas.parentElement!;
        const scale = Math.min(canvas.clientWidth / w, canvas.clientHeight / h);
        const cx = (canvas.clientWidth - w * scale) / 2 + (region[0] + region[2]) / 2 * w * scale;
        const cy = (canvas.clientHeight - h * scale) / 2 + (region[1] + region[3]) / 2 * h * scale;
        viewport.scrollTo({ left: cx - viewport.clientWidth / 2, top: cy - viewport.clientHeight / 2 });
      }
    };
    if (img.complete) draw();
    else img.addEventListener("load", draw, { once: true });
  });
}

export function revealTaskViewer(main: HTMLElement): void {
  main.querySelectorAll<HTMLElement>(".task-viewer .viewer-comparison, .task-viewer .viewer-key").forEach(el => el.hidden = false);
}

export function handleViewerClick(button: HTMLButtonElement): boolean {
  const viewer = button.closest<HTMLElement>(".task-viewer");
  if (!viewer) return false;
  const current = viewer.querySelector<HTMLElement>("figure:not([hidden]) .viewer-viewport")!;
  const x = current.scrollLeft / (current.scrollWidth - current.clientWidth || 1);
  const y = current.scrollTop / (current.scrollHeight - current.clientHeight || 1);
  if (button.hasAttribute("data-viewer-zoom")) {
    const enlarged = viewer.classList.toggle("enlarged");
    button.setAttribute("aria-pressed", String(enlarged));
    button.textContent = enlarged ? "Fit image" : "Zoom in";
  } else if (button.dataset.viewerView) {
    viewer.dataset.mode = button.dataset.viewerView === "split" ? "split" : "ab";
    viewer.dataset.view = button.dataset.viewerView;
    viewer.querySelectorAll<HTMLButtonElement>("[data-viewer-view]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    viewer.querySelectorAll<HTMLElement>("[data-viewer-image]").forEach(frame => {
      frame.hidden = viewer.dataset.mode !== "split" && frame.dataset.viewerImage !== viewer.dataset.view;
    });
  } else return false;
  viewer.querySelectorAll<HTMLElement>(".viewer-viewport").forEach(viewport => {
    viewport.scrollLeft = x * (viewport.scrollWidth - viewport.clientWidth);
    viewport.scrollTop = y * (viewport.scrollHeight - viewport.clientHeight);
  });
  return true;
}

export function syncViewerScroll(event: Event): void {
  const viewport = event.target;
  if (!(viewport instanceof HTMLElement) || !viewport.classList.contains("viewer-viewport")) return;
  const viewer = viewport.closest<HTMLElement>(".task-viewer");
  if (viewer?.dataset.mode !== "split") return;
  viewer.querySelectorAll<HTMLElement>(".viewer-viewport").forEach(other => {
    if (other !== viewport && (other.scrollLeft !== viewport.scrollLeft || other.scrollTop !== viewport.scrollTop)) {
      other.scrollLeft = viewport.scrollLeft;
      other.scrollTop = viewport.scrollTop;
    }
  });
}
