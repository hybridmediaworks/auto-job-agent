/**
 * Detect when a user's custom prompt conflicts with the one-page constraint.
 *
 * Triggers a warning if the prompt asks for more bullets/content than a
 * one-page resume can fit. The detection is heuristic — we surface a warning,
 * not block the submit.
 */

export type PromptWarning = {
  kind: 'one-page-conflict'
  message: string
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

function parseNumberToken(s: string): number | null {
  const n = parseInt(s, 10)
  if (!Number.isNaN(n)) return n
  const w = NUMBER_WORDS[s.toLowerCase()]
  return w ?? null
}

/**
 * Looks for patterns like:
 *   - "3 bullets", "8 bullet points"
 *   - "five bullets"
 *   - "more bullets", "longer bullets", "expanded summary"
 *   - "add a bullet", "another bullet"
 *
 * Returns a warning if the prompt + one_page flag are in conflict.
 */
export function detectOnePageConflict(customPrompt: string, onePage: boolean): PromptWarning | null {
  if (!onePage) return null
  const text = customPrompt.trim()
  if (!text) return null

  const low = text.toLowerCase()

  // Number tokens (numeric or written word)
  const NUM = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten)`
  // Bullet noun phrases
  const NOUN = String.raw`(bullets?|bullet\s*points?|points?)`

  // Match BOTH orderings:
  //   "make 8 bullets"           — number before noun
  //   "make bullets 8"           — number after noun (natural English from QA)
  //   "bullet points of ABC 3"   — noun + filler + number
  const patterns = [
    new RegExp(`\\b${NUM}\\s+${NOUN}\\b`, 'gi'),
    new RegExp(`\\b${NOUN}(?:[^.\\n\\d]{0,40})?\\b${NUM}\\b`, 'gi'),
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(low)) !== null) {
      // The numeric group sits at index 1 for the first pattern, index 2 for the second.
      const numToken = parseNumberToken(m[1]) ?? parseNumberToken(m[2])
      if (numToken !== null && numToken > 3) {
        return {
          kind: 'one-page-conflict',
          message: `You asked for ${numToken} bullets, but the 1-page limit caps it at 3 per role — this might exceed one page.`,
        }
      }
    }
  }

  // Generic "more/longer/extra bullets" / "expand", "add a/more bullet(s)"
  const verbose = /\b(more|longer|extra|expand(ed)?|add(?:ing)?\s+(another|a|more)?\s*bullets?)\b/i
  if (verbose.test(low) && /\bbullets?|points?|summary|content\b/i.test(low)) {
    return {
      kind: 'one-page-conflict',
      message: 'You asked for more/longer content, but 1-page is selected — this might exceed one page.',
    }
  }

  return null
}
