// Only the Latin and Greek subsets, to keep the single-file page small.
import "@fontsource/gentium-book-plus/latin-400.css";
import "@fontsource/gentium-book-plus/greek-400.css";
import "@fontsource/gentium-book-plus/latin-700.css";
import "@fontsource/gentium-book-plus/greek-700.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "./styles.css";

import { load } from "./store";
import { renderHome } from "./views/home";
import { renderAlphabet } from "./views/alphabet";
import { renderDrill } from "./views/drill";
import { renderResults } from "./views/results";
import { renderLearn } from "./views/learn";
import { renderAbout } from "./views/about";

type Cleanup = (() => void) | void;

const routes: [RegExp, string, (main: HTMLElement, ...args: string[]) => Cleanup][] = [
  [/^#?\/?$/, "Path", renderHome],
  [/^#\/alphabet$/, "Alphabet", renderAlphabet],
  [/^#\/drill\/([a-z0-9-]+)$/, "Exercise", renderDrill],
  [/^#\/results$/, "My results", renderResults],
  [/^#\/learn$/, "Keep learning", renderLearn],
  [/^#\/about$/, "About", renderAbout],
];

let cleanup: Cleanup;

function route(): void {
  const main = document.getElementById("main") as HTMLElement;
  if (typeof cleanup === "function") cleanup();
  const hash = window.location.hash || "#/";
  const match = routes.find(([re]) => re.test(hash));
  const [re, title, view] = match ?? routes[0];
  const args = hash.match(re)?.slice(1) ?? [];
  main.innerHTML = "";
  cleanup = view(main, ...args);
  document.title = title === "Path" ? "The Little Papyrologist" : `${title} – The Little Papyrologist`;

  const top = "#/" + (hash.split("/")[1] ?? "");
  document.querySelectorAll<HTMLAnchorElement>(".topbar nav a").forEach((a) => {
    const here = a.getAttribute("href") === top || (top === "#/drill" && a.getAttribute("href") === "#/");
    if (here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (match && hash !== "#/") main.focus({ preventScroll: true });
}

load();
window.addEventListener("hashchange", route);
route();
