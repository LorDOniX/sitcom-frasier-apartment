import * as THREE from 'three';
import { audio } from '../audio';
import { hideInfo, infoSource, showInfo } from '../info';
import type { Interactable } from '../interact';

/** Klavír: E zahraje začátek Bachova Preludia C dur, další E hraní ukončí. */
export class PianoPlayer implements Interactable {
  targets: THREE.Object3D[] = [];
  private stop: (() => void) | null = null;

  constructor(private pos: THREE.Vector3) {}

  hint() {
    return this.stop ? 'přestat hrát' : 'zahrát na klavír';
  }

  interact() {
    if (this.stop) {
      this.stop();
      return;
    }
    this.stop = audio.playPrelude(this.pos, () => (this.stop = null));
  }
}

/** Rádio naladěné na KACL 780 (vlastní znělka, syntetizovaný hlas a hudba). */
export class RadioSet implements Interactable {
  targets: THREE.Object3D[] = [];
  private stop: (() => void) | null = null;

  constructor(
    private pos: THREE.Vector3,
    private onChange?: (on: boolean) => void,
  ) {}

  hint() {
    return this.stop ? 'vypnout rádio' : 'zapnout rádio KACL';
  }

  interact() {
    audio.click(this.pos);
    if (this.stop) {
      this.stop();
      this.stop = null;
    } else {
      this.stop = audio.radioOn(this.pos);
    }
    this.onChange?.(!!this.stop);
  }
}

/** Popisek zajímavosti: E otevře / zavře panel s textem. */
export class InfoItem implements Interactable {
  targets: THREE.Object3D[] = [];

  constructor(
    private title: string,
    private text: string,
  ) {}

  hint() {
    return infoSource() === this ? `zavřít: ${this.title}` : `o předmětu: ${this.title}`;
  }

  interact() {
    if (infoSource() === this) hideInfo();
    else showInfo(this, this.title, this.text);
  }
}
