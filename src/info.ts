/** Informační panel o předmětu (popisky zajímavostí, data v src/data/info.json). */
const el = () => document.getElementById('info')!;
let source: object | null = null;

export function showInfo(src: object, title: string, text: string) {
  source = src;
  const box = el();
  box.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = title;
  box.append(h);
  for (const para of text.split('\n\n')) {
    const p = document.createElement('p');
    p.textContent = para;
    box.append(p);
  }
  box.hidden = false;
}

export function hideInfo() {
  source = null;
  el().hidden = true;
}

/** Předmět, o kterém je panel právě otevřený (nebo null). */
export function infoSource(): object | null {
  return source;
}
