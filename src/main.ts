import { startGame } from './game/main';

const game = startGame('game-container');

// Dev builds only: inspect and drive the game from the browser console.
if (import.meta.env.DEV) (window as unknown as { game: typeof game }).game = game;
