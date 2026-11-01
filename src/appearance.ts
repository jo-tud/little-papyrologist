/** Appearance is a device preference, separate from learning progress. */
export function initAppearance(): void {
  const select = document.querySelector<HTMLSelectElement>("#appearance");
  if (!select) return;
  select.value = document.documentElement.dataset.theme ?? "light";
  select.addEventListener("change", () => {
    document.documentElement.dataset.theme = select.value;
    try {
      localStorage.setItem("little-papyrologist:appearance", select.value);
    } catch { /* Keep the chosen appearance for this visit. */ }
  });
}
