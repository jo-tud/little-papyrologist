const REPO = "https://github.com/jo-tud/little-papyrologist";

export function renderAbout(main: HTMLElement): void {
  main.innerHTML = `
  <h1>About</h1>
  <p>The Little Papyrologist is a small, free trainer for people who look at images of the
  Herculaneum scrolls and wonder: are those letters? Which ones? It will not make you a
  papyrologist. It is a first step: learning the scribes' letters, the usual look-alikes, and
  above all noticing when there is nothing to see.</p>
  <p><strong>This is not an official project of the Vesuvius Challenge</strong> and is not affiliated with it.
  It is made by Jo (<a href="https://github.com/jo-tud" rel="noopener">jo-tud</a>).</p>

  <h2>Where the answers come from</h2>
  <p>An answer in this trainer comes only from one of these:</p>
  <ul class="sources-list">
    <li>readings checked by papyrologists and published by them,</li>
    <li>physical evidence, such as infrared photos of opened fragments,</li>
    <li>labels published by the Vesuvius Challenge,</li>
    <li>for the drawn exercises of level 0: the drawing itself, so the answer is known exactly.</li>
  </ul>
  <p>Never from a model's output alone, and never from a guess. Where an edition marks a letter
  as uncertain, the trainer shows it as uncertain. A tile without a reliable answer does not
  go into the quiz.</p>

  <h2>Learning through practice</h2>
  <p>The guided path introduces shapes and reading methods; extra rounds let you revisit them.
  Altered views reuse known source images. They can help you practise with less detail, but do not
  replace encountering different handwriting. Results show repeated attempts and counts of source regions separately.</p>
  <p>In level 3, blur, noise and partial covering are deliberate image exercises, not scans at a
  different resolution. The unchanged source explains the answer; it does not guarantee that
  every letter can still be recognized in the altered image. Saying “not sure” is welcome.</p>

  <h2>Your data</h2>
  <p>The page has no server, no tracking and no analytics. Your answers, badges and ranks are
  stored in your browser. You can save or copy them yourself to keep a backup or move them to
  another browser (at the end of <a href="#/results">My results</a>).</p>

  <h2>Licenses</h2>
  <p>The code and the drawn letters and exercise tiles are released under the MIT License. Fonts: Gentium Book Plus (SIL International) and
  Atkinson Hyperlegible Next (The Atkinson Hyperlegible Next Project Authors), both under the
  SIL Open Font License 1.1.
  Images derived from Vesuvius Challenge data carry their license (CC BY-NC 4.0), credit and
  source next to them. Details: <a href="${REPO}/blob/main/LICENSES.md" rel="noopener">LICENSES.md</a>.</p>

  <h2>Mistakes and ideas</h2>
  <p>If you spot an error, please open an issue on <a href="${REPO}/issues" rel="noopener">GitHub</a>.
  Corrections from people who read Greek papyri are especially welcome.</p>`;
}
