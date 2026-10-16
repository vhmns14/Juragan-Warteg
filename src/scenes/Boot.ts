import Phaser from 'phaser';
import { preloadAssets, setupAssets } from '../assets';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { preloadAssets(this); }
  create() { setupAssets(this); this.scene.start('Title'); }
}
