# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""blender -b -t 3 -P assets-src/characters/batch-a/build.py -- CH02 ..."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model import build
from workshop import titan, copperhead
from optics import unicorn, hydra
from skywell import thunderbird, dragon
from clockworks import scorpion

authors={'CH02':(2.6,titan),'CH04':(1.1,copperhead),'CH05':(2.0,unicorn),
         'CH06':(2.2,hydra),'CH07':(2.1,thunderbird),'CH08':(1.45,dragon),'CH09':(.65,scorpion)}
for asset in sys.argv[sys.argv.index('--')+1:]:
    build(asset,*authors[asset])
