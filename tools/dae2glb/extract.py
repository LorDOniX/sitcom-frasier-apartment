#!/usr/bin/env python3
"""Rozbalí stažené modely ze stazene/ (ZIP z 3D Warehouse nebo holé .dae) do tools/out/dl/<slug>/.

Soubory z 3D Warehouse mají často zavádějící příponu (.dae je ve skutečnosti ZIP a naopak),
proto se rozhoduje podle obsahu. Cesty uvnitř ZIPu se kontrolují (žádné ../).
"""
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'stazene')
OUT = os.path.join(ROOT, 'tools', 'out', 'dl')


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    for f in sorted(os.listdir(SRC)):
        p = os.path.join(SRC, f)
        if f.lower().endswith(('.jpg', '.jpeg', '.png')) or not os.path.isfile(p):
            continue
        slug = re.sub(r'[^a-z0-9]+', '_', os.path.splitext(f)[0].lower()).strip('_')
        d = os.path.join(OUT, slug)
        os.makedirs(d)
        if zipfile.is_zipfile(p):
            with zipfile.ZipFile(p) as z:
                for info in z.infolist():
                    n = os.path.normpath(info.filename)
                    if n.startswith('..') or os.path.isabs(n) or info.file_size > 60e6:
                        print('přeskočeno', f, n)
                        continue
                    z.extract(info, d)
        else:
            shutil.copy(p, os.path.join(d, 'model.dae'))
        print(slug)


if __name__ == '__main__':
    sys.exit(main())
