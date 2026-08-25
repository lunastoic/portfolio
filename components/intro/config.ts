/**
 * 3D ASCII intro layer — master switches.
 *
 * INTRO_ENABLED=false keeps the intro off for all visitors. Preview it
 * locally with ?intro=1 (and pick the glyph font with ?introfont=mono
 * or ?introfont=vt323). ?fps=1 shows a frame-rate meter.
 */
export const INTRO_ENABLED = false;

/** Fixed character grid (Phase 2 decision: no auto-downscaling yet). */
export const INTRO_COLS = 150;
export const INTRO_ROWS = 80;

/** Brightness ramp, dark → bright. Index 0 (space) is never drawn. */
export const CHAR_RAMP = " .:-=+*#%@";

/** Seconds of idle before the [ ENTER ] prompt fades in. */
export const ENTER_PROMPT_DELAY_MS = 2500;
