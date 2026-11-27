# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run with Blender --background --python build.py -- CH16 [CH...]"""
from pathlib import Path
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import sculpt
from aviary import phoenix,eagle
from workshop import golem,tortoise
from market import mole,badger,chimera
models={'CH10':(phoenix,1.9),'CH11':(eagle,1.8),'CH12':(golem,1.9),
        'CH13':(tortoise,1.1),'CH14':(mole,1.2),'CH15':(badger,1.2),
        'CH16':(sculpt.crab,.8),'CH17':(chimera,1.7)}
for asset in sys.argv[sys.argv.index('--')+1:]:
    sculpt.build(asset,*models[asset])
