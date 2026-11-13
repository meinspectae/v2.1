"""Create static embedded instances of the existing Inter brand face."""
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'public/fonts'
source = root / '020aa92f43dd4ac5b3795dd3c9205387.ttf'
for name, weight in [('Regular', 400), ('Bold', 700)]:
    font = instantiateVariableFont(TTFont(source), {'opsz': 14, 'wght': weight}, inplace=False)
    font.save(root / f'Inter-{name}.ttf')
italic = instantiateVariableFont(TTFont(root / '4f7db5d1ef384522aaa58c5f42d59685.ttf'), {'opsz': 14, 'wght': 400}, inplace=False)
italic.save(root / 'Inter-Italic.ttf')
