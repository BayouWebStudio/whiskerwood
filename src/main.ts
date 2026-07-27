import './style.css';
import { GameEngine } from './engine/GameEngine';

const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

const game = new GameEngine(canvas);
game.start();
