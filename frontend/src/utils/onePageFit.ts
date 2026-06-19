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
  // Page 1 prints FULL-BLEED (the print CSS sets @page :first { margin: 0 }), so the
  // usable first-page height at 96dpi is the full A4 = ~1122px. Pages 2+ keep 10mm
  // top+bottom margins ≈ 1047px usable.
  if (onePage) {
    // One-page mode: content at or under ~1122 already fits exactly one page, so we
    // only act on genuine overflow. When it overflows we scale on the Y axis ONLY
    // (scaleY) to fit the page HEIGHT while KEEPING the full 794px width — this fills
    // the page edge-to-edge with NO white side margins. A uniform scale() shrinks the
    // width too and leaves the symmetric side "padding"; scaleY trades that padding for
    // a small vertical compression instead. Origin top-left keeps the top edge flush.
    return (
      "try{var __f=document.getElementById('__fit');var __e=__f&&__f.firstElementChild;" +
      "if(__e){var __t=1122;var __p=1118;var __h=__e.scrollHeight;" +
      "if(__h>__t){var __s=__p/__h;__e.style.transformOrigin='top left';" +
      "__e.style.transform='scaleY('+__s+')';__f.style.height=__p+'px';__f.style.overflow='hidden';}}}catch(e){}"
    )
  }
  // Multi-page mode: stretch the template ROOT to the exact bottom of the last
  // printed page, so structural elements that span the template height (e.g. the
  // Adeel V2 cyan divider, colored sidebars) terminate the final page cleanly
  // instead of stopping mid-air and leaving raw trailing white space.
  return (
    "try{var __f=document.getElementById('__fit');var __e=__f&&__f.firstElementChild;" +
    "if(__e){var __r=__e.firstElementChild||__e;var __h=__e.scrollHeight;" +
    "if(__h>1122){var __n=1+Math.ceil((__h-1122)/1047);" +
    "__r.style.minHeight=(1122+(__n-1)*1047)+'px';}}}catch(e){}"
  )
}
