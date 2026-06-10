/**
 * Auto-fit-to-one-page helper for the PDF print window.
 *
 * The resume PDF is produced by writing the captured template HTML into a new
 * window and calling window.print(). Templates grow with content, so a long
 * resume would normally spill onto a 2nd page. When a resume was generated in
 * one-page mode we guarantee a single page: measure the rendered height and, if
 * it exceeds one A4 page, uniformly scale the resume down to fit.
 *
 * The captured HTML must be wrapped in an element with id="__fit" whose first
 * child is the resume root, e.g. `<div id="__fit" style="transform-origin:top left">${html}</div>`.
 *
 * Returns an inline JS snippet (string) to embed in the print window's <script>,
 * to run BEFORE window.print(). Returns "" when one-page mode is off (no scaling).
 */
export function onePageFitScript(onePage: boolean): string {
  if (!onePage) return ''
  // 1080px ≈ A4 portrait printable height at 96dpi for the 794px-wide template
  // (first page: 297mm − 10mm bottom margin), with a small safety buffer.
  return (
    "try{var __f=document.getElementById('__fit');var __e=__f&&__f.firstElementChild;" +
    "if(__e){var __p=1080;var __h=__e.scrollHeight;" +
    "if(__h>__p){var __s=__p/__h;__e.style.transformOrigin='top left';" +
    "__e.style.transform='scale('+__s+')';__f.style.height=__p+'px';__f.style.overflow='hidden';}}}catch(e){}"
  )
}
