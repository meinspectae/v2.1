"""Fill the existing Arabic font's Latin coverage using the existing Inter face."""
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/fonts'
target=TTFont(root/'NotoNaskhArabic-Regular.ttf')
latin=TTFont(root/'Inter-Regular.ttf')
# Preserve Arabic GSUB/GPOS and metrics. Add only missing Latin glyph outlines.
ratio=target['head'].unitsPerEm/latin['head'].unitsPerEm
cmap=target.getBestCmap(); order=list(target.getGlyphOrder()); glyphset=latin.getGlyphSet()
for code,name in latin.getBestCmap().items():
    if code in cmap or code > 0x206f: continue
    new='inter_'+name
    if new not in target['glyf']:
        pen=TTGlyphPen(None)
        # Decompose composites first, then scale to the Arabic units-per-em.
        from fontTools.pens.recordingPen import DecomposingRecordingPen
        recording=DecomposingRecordingPen(glyphset); glyphset[name].draw(recording)
        recording.replay(TransformPen(pen,(ratio,0,0,ratio,0,0)))
        target['glyf'][new]=pen.glyph()
        aw,lsb=latin['hmtx'][name]; target['hmtx'][new]=(round(aw*ratio),round(lsb*ratio))
        order.append(new)
    for table in target['cmap'].tables:
        if table.isUnicode() and (table.format==12 or code<=0xffff): table.cmap[code]=new
    cmap[code]=new
target.setGlyphOrder(order)
target.save(root/'NotoNaskhArabic-Report.ttf')
