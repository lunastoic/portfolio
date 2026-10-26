/**
 * Whether a game is running on the desk computer. While one is, the room's own animations (the steam, the lava
 * lamp) hold still, so the game has the frame rate to itself.
 */
let playing = false;

export const gameOn = () => playing;

export function setGameOn(on: boolean) {
  playing = on;
}
