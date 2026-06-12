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
  // First-page printable height at 96dpi for the 794px A4 template: 297mm − 10mm
  // bottom margin ≈ 1085px. Every template's root has minHeight 1085, so content
  // at or under 1085 already fits exactly one page — only scale on real overflow,
  // targeting 1080 (a 5px safety buffer) so short resumes print fully unscaled.
  return (
    "try{var __f=document.getElementById('__fit');var __e=__f&&__f.firstElementChild;" +
    "if(__e){var __t=1085;var __p=1080;var __h=__e.scrollHeight;" +
    "if(__h>__t){var __s=__p/__h;__e.style.transformOrigin='top left';" +
    "__e.style.transform='scale('+__s+')';__f.style.height=__p+'px';__f.style.overflow='hidden';}}}catch(e){}"
  )
}
