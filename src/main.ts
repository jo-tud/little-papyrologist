// Only the Latin and Greek subsets, to keep the single-file page small.
import "@fontsource/gentium-book-plus/latin-400.css";
import "@fontsource/gentium-book-plus/greek-400.css";
import "@fontsource/gentium-book-plus/latin-700.css";
import "@fontsource/gentium-book-plus/greek-700.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "./styles.css";

import { load, skipIntro } from "./store";
import { renderHome } from "./views/home";
import { renderAlphabet } from "./views/alphabet";
import { renderDrill } from "./views/drill";
import { renderResults } from "./views/results";
import { renderLearn } from "./views/learn";
import { renderAbout } from "./views/about";
import { renderRanks } from "./views/ranks";
import { renderQuiz } from "./views/quiz";
import { syncRankChip } from "./progress-ui";

type Cleanup = (() => void) | void;

const routes: [RegExp, string, (main: HTMLElement, ...args: string[]) => Cleanup][] = [
  [/^#?\/?$/, "Path", renderHome],
  [/^#\/alphabet$/, "Alphabet", renderAlphabet],
  [/^#\/drill\/([a-z0-9-]+)$/, "Exercise", renderDrill],
  [/^#\/quiz\/([a-z0-9-]+)$/, "Quiz", renderQuiz],
  [/^#\/practice\/([1-3])$/, "Practice", (main, level) => renderQuiz(main, `practice-${level}`)],
  [/^#\/results$/, "My results", (main) => renderResults(main)],
  [/^#\/learn$/, "Keep learning", renderLearn],
  [/^#\/about$/, "About", renderAbout],
  [/^#\/ranks$/, "Ranks", renderRanks],
];

let cleanup: Cleanup;

function route(event?: Event): void {
  const main = document.getElementById("main") as HTMLElement;
  if (typeof cleanup === "function") cleanup();
  document.querySelector(".toast-area")?.replaceChildren();
  const hash = window.location.hash || "#/";
  const match = routes.find(([re]) => re.test(hash));
  const [re, title, view] = match ?? routes[0];
  const args = hash.match(re)?.slice(1) ?? [];
  main.innerHTML = "";
  cleanup = view(main, ...args);
  document.title = title === "Path" ? "The Little Papyrologist" : `${title} – The Little Papyrologist`;

  const top = "#/" + (hash.split("/")[1] ?? "");
  document.querySelectorAll<HTMLAnchorElement>(".topbar nav a").forEach((a) => {
    const here = a.getAttribute("href") === top || ((top === "#/drill" || top === "#/quiz" || top === "#/practice") && a.getAttribute("href") === "#/");
    if (here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  syncRankChip();
  const chip = document.getElementById("rank-chip");
  if (top === "#/ranks") chip?.setAttribute("aria-current", "page");
  else chip?.removeAttribute("aria-current");
  window.scrollTo(0, 0);
  if (event || hash !== "#/") main.focus({ preventScroll: true });
}

load();
document.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("[data-skip-intro]")) skipIntro();
});
document.querySelector(".skip")?.addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("main")?.focus();
});
window.addEventListener("hashchange", route);
route();
