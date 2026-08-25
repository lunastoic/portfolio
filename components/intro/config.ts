/**
 * 3D ASCII intro layer — master switches.
 *
 * INTRO_ENABLED=false keeps the intro off for all visitors. Preview it
 * locally with ?intro=1 (and pick the glyph font with ?introfont=mono
 * or ?introfont=vt323). ?fps=1 shows a frame-rate meter.
 */
export const INTRO_ENABLED = false;

/** Grid density: one character cell per this many CSS pixels. */
export const TARGET_CELL_PX = 8;

/** Brightness ramp, dark → bright. Index 0 (space) is never drawn.
 * 18 steps for smoother tonal gradients (glyphs chosen for mono legibility). */
export const CHAR_RAMP = " .'`^:;!i~+=*x#%$@";

/** Seconds of idle before the [ ENTER ] prompt fades in. */
export const ENTER_PROMPT_DELAY_MS = 2500;
