// Varianta plakátu Rauschenberg s texturou z aukční fotky (stazene/reference/19.jpg, Julien's Auctions)
// místo textury z 3D Warehouse. Výstup: assets/models/custom/poster_rauschenberg_foto.glb, pak npm run assets.
// Fotka i model jsou chráněné – jen pro lokální použití (složky jsou v .gitignore).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = 'assets/models/custom/poster_rauschenberg.glb';
const PHOTO = 'stazene/reference/19.jpg';
const OUT = 'assets/models/custom/poster_rauschenberg_foto.glb';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);

// výřez papíru uvnitř rámu (bez horního a dolního okraje), roztažený na poměr plochy v modelu (0,74);
// převod z Collady ukládá obrázky převrácené, proto flip
const img = await sharp(PHOTO)
  .extract({ left: 154, top: 150, width: 1186, height: 1700 })
  .resize(1036, 1400, { fit: 'fill' })
  .flip()
  .jpeg({ quality: 90 })
  .toBuffer();

// plocha plakátu používá jen pruh u 0,13–0,87 čtvercové textury => UV roztáhnout na 0–1
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const tex = prim.getMaterial()?.getBaseColorTexture();
    if (tex?.getMimeType() !== 'image/jpeg') continue;
    const uv = prim.getAttribute('TEXCOORD_0');
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < uv.getCount(); i++) {
      const u = uv.getElement(i, [])[0];
      lo = Math.min(lo, u);
      hi = Math.max(hi, u);
    }
    for (let i = 0; i < uv.getCount(); i++) {
      const [u, v] = uv.getElement(i, []);
      uv.setElement(i, [(u - lo) / (hi - lo), v]);
    }
    tex.setImage(new Uint8Array(img));
  }
}
await io.write(OUT, doc);
console.log(`${OUT} hotovo – teď npm run assets`);
