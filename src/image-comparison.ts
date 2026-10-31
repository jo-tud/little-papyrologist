import { esc } from "./util";
import "./image-comparison.css";

interface ComparisonImage {
  file: string;
  label: string;
  alt: string;
}

let preferredMode: "split" | "ab" = "split";

/** Both views keep the same frame and scale. No new tracing or reading is inferred. */
export function imageComparison(original: ComparisonImage, reference: ComparisonImage): string {
  return `<section class="image-comparison" data-mode="${preferredMode}" data-view="original" aria-label="Compare the images">
    <div class="comparison-controls">
      <div class="row" role="group" aria-label="Comparison layout">
        <button type="button" data-comparison-mode="split" aria-pressed="${preferredMode === "split"}">Side by side</button>
        <button type="button" data-comparison-mode="ab" aria-pressed="${preferredMode === "ab"}">A/B view</button>
      </div>
      <button type="button" class="linkish" data-comparison-zoom aria-pressed="false">Zoom in</button>
    </div>
    <div class="row comparison-switch" role="group" aria-label="Image to show" ${preferredMode === "split" ? "hidden" : ""}>
      <button type="button" data-comparison-view="original" aria-pressed="true">A · ${esc(original.label)}</button>
      <button type="button" data-comparison-view="reference" aria-pressed="false">B · ${esc(reference.label)}</button>
    </div>
    <div class="comparison-images">${[original, reference].map((img, i) => `<figure data-comparison-image="${i ? "reference" : "original"}" ${i && preferredMode === "ab" ? "hidden" : ""}>
      <figcaption class="small">${i ? "B" : "A"} · ${esc(img.label)}</figcaption>
      <div class="comparison-viewport" tabindex="0" role="region" aria-label="${esc(img.label)}; scroll to explore when enlarged">
        <img src="images/${esc(img.file)}" alt="${esc(img.alt)}">
      </div>
    </figure>`).join("")}</div>
  </section>`;
}

export function handleComparisonClick(button: HTMLButtonElement): boolean {
  const comparison = button.closest<HTMLElement>(".image-comparison");
  if (!comparison) return false;
  const visible = comparison.querySelector<HTMLElement>("figure:not([hidden]) .comparison-viewport")!;
  const x = visible.clientWidth ? visible.scrollLeft / visible.clientWidth : 0;
  const y = visible.clientHeight ? visible.scrollTop / visible.clientHeight : 0;
  if (button.dataset.comparisonMode) {
    comparison.dataset.mode = button.dataset.comparisonMode;
    preferredMode = button.dataset.comparisonMode as "split" | "ab";
    comparison.querySelector<HTMLElement>(".comparison-switch")!.hidden = button.dataset.comparisonMode !== "ab";
    comparison.querySelectorAll<HTMLButtonElement>("[data-comparison-mode]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  } else if (button.dataset.comparisonView) {
    comparison.dataset.view = button.dataset.comparisonView;
    comparison.querySelectorAll<HTMLButtonElement>("[data-comparison-view]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  } else if (button.hasAttribute("data-comparison-zoom")) {
    const enlarged = comparison.classList.toggle("enlarged");
    button.setAttribute("aria-pressed", String(enlarged));
    button.textContent = enlarged ? "Zoom out" : "Zoom in";
  } else return false;
  comparison.querySelectorAll<HTMLElement>("[data-comparison-image]").forEach(frame => {
    frame.hidden = comparison.dataset.mode === "ab" && frame.dataset.comparisonImage !== comparison.dataset.view;
    if (!frame.hidden) {
      const viewport = frame.querySelector<HTMLElement>(".comparison-viewport")!;
      viewport.scrollLeft = x * viewport.clientWidth;
      viewport.scrollTop = y * viewport.clientHeight;
    }
  });
  return true;
}

/** A scroll in either enlarged view moves its matching view to the same place. */
export function syncComparisonScroll(event: Event): void {
  const viewport = event.target;
  if (!(viewport instanceof HTMLElement) || !viewport.classList.contains("comparison-viewport") || viewport.closest<HTMLElement>("figure")?.hidden) return;
  viewport.closest(".image-comparison")?.querySelectorAll<HTMLElement>(".comparison-viewport").forEach(other => {
    if (other === viewport || other.closest<HTMLElement>("figure")?.hidden) return;
    if (other.scrollLeft !== viewport.scrollLeft) other.scrollLeft = viewport.scrollLeft;
    if (other.scrollTop !== viewport.scrollTop) other.scrollTop = viewport.scrollTop;
  });
}
