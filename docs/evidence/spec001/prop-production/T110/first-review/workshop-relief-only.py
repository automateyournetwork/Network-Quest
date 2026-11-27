# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""One original assembly per piece of workshop equipment."""
import sys
# Blender's --python entry runs as __main__; use its current asset and shared palette.
m = sys.modules['__main__']
RECIPES = {'PR012': m.relief}
