import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { Boot } from './scenes/Boot';
import { ChestReveal } from './scenes/ChestReveal';
import { Cutscene } from './scenes/Cutscene';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { HUD } from './scenes/HUD';
import { LevelUp } from './scenes/LevelUp';
import { Loading } from './scenes/Loading';
import { MainMenu } from './scenes/MainMenu';

export function startGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#000000',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { gamepad: true },
    // Scene order is draw order: modal scenes render above Game and HUD.
    scene: [Boot, MainMenu, Loading, Game, HUD, LevelUp, ChestReveal, Cutscene, GameOver],
  });
}
