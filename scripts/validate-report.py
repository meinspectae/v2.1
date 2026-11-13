"""Inspect the actual app-generated fixture: text, fonts, photos, geometry and page order."""
import json,re,sys
from pathlib import Path
from io import BytesIO
import pymupdf as fitz
from PIL import Image

root=Path(__file__).resolve().parents[1]
path=root/'public/meinspect-test-report.pdf'
legal=json.loads((root/'scripts/report-legal-snapshot.json').read_text())
doc=fitz.open(path)
mm=72/25.4
normalize=lambda s:re.sub(r'\s+','',s)
texts=[p.get_text() for p in doc]
full='\n'.join(texts)
assert path.stat().st_size<20*1024*1024
assert len(doc)>=5
assert 'Property Condition Report' in texts[0]
assert 'Rating legend' in texts[1] and 'Inspection overview' in texts[1]
assert 'Report Scope & Method' in texts[2]
assert 'Keys & Access Cards' in texts[3]
assert 'Legal Declaration' in texts[-1] and 'Not signed at inspection' in texts[-1]
assert 'No items inspected in this room' in full
for forbidden in ['MUST NOT PRINT','EMPTY ROOM UNRATED ITEM','Utility Meter Readings','legally binding','same legal weight','Federal Law No. 1','Pending legal review']:
    assert forbidden not in full,forbidden
for i,page in enumerate(doc):
    t=normalize(page.get_text())
    for expected in [f'Page{i+1}of{len(doc)}','GPS:25.080000,55.140000','IP:192.0.2.1','RPT-TEST-LAY','4e5539a81eb741f0']:
        assert expected in t,(i+1,expected)
    assert abs(page.rect.width-210*mm)<.1 and abs(page.rect.height-297*mm)<.1
    assert len(page.get_text(clip=fitz.Rect(0,27*mm,210*mm,272*mm)).strip())>30,'Blank/body-empty page'
    for font in page.get_fonts():
        assert doc.extract_font(font[0])[3],('Unembedded font',font)
    # Image boxes cannot cross body/footer or side margins.
    for image in page.get_image_info():
        box=fitz.Rect(image['bbox'])
        assert box.x0>=15*mm-.5 and box.x1<=195*mm+.5,(i+1,box)
        assert box.y0>=15*mm-.5 and box.y1<275*mm,(i+1,box)
        assert abs(box.width/box.height-image['width']/image['height'])<.015,('Stretched',box)

# Exact English wording in the left column, and matching clause IDs in both columns.
left=doc[2].get_text(clip=fitz.Rect(15*mm,27*mm,105*mm,272*mm))
right=doc[2].get_text(clip=fitz.Rect(105*mm,27*mm,195*mm,272*mm))
for clause,text in legal['en']['clauses']:
    assert clause in left and clause in right,clause
    assert normalize(text) in normalize(left),('English clause mismatch',clause)
assert normalize(legal['en']['declaration']) in normalize(texts[-1])
assert doc[2].search_for('العقار'),'Arabic is not searchable'
assert doc[2].search_for('يسجّل'),'Arabic diacritics missing'
assert doc[2].search_for('inspection'),'English is not searchable'

photos={}
for page in doc:
    for entry in page.get_images():
        if entry[2]>=900 and entry[3]>=900:photos[entry[0]]=entry
assert len(photos)==34,('Wrong independent photo count',len(photos))
for xref,img in photos.items():
    assert (img[2],img[3]) in [(900,1200),(1200,900)],img
    assert img[8]=='DCTDecode',img
    image=Image.open(BytesIO(doc.extract_image(xref)['image']))
    assert image.layer[0][1:3]==(2,2),'JPEG is not 4:2:0'
    # Corner markers prove the complete original frame is retained.
    for x,y in [(10,10),(image.width-10,10),(10,image.height-10),(image.width-10,image.height-10)]:
        r,g,b=image.getpixel((x,y));assert b>r+40,('Missing corner',xref,x,y)
# At least one row of three 50mm portraits, all with the same top and 3mm gaps.
triples=0
for page in doc:
    portrait=[i for i in page.get_image_info() if i['width']==900 and i['height']==1200 and 48*mm<fitz.Rect(i['bbox']).width<51*mm]
    for j in range(len(portrait)-2):
        a,b,c=[fitz.Rect(i['bbox']) for i in portrait[j:j+3]]
        if abs(a.y0-b.y0)<1 and abs(b.y0-c.y0)<1:triples+=1
assert triples>0
# Last-page link is retained, but fixture is deliberately never registered in live storage.
assert doc[-1].get_links()
# Whole page snapshots and a 300% detail crop of the two-pixel mark.
doc[2].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(root/'legal-final-check.png')
for page in doc:
    found=next((i for i in page.get_image_info() if i['width']==900 and i['height']==1200 and fitz.Rect(i['bbox']).width>48*mm),None)
    if found:
        box=fitz.Rect(found['bbox']);x=box.x0+box.width*.4;y=box.y0+box.height*.4
        page.get_pixmap(matrix=fitz.Matrix(3,3),clip=fitz.Rect(x-10,y-10,x+20,y+15)).save(root/'report-scratch-300.png');break
result={'pages':len(doc),'bytes':path.stat().st_size,'photos':len(photos),'legalClausesPerLanguage':19,'tests':'PASS','limitations':['Synthetic fixture only; no physical camera or authenticated cloud finalisation tested','Per-signer IP absent in existing Signature records; report prints Not recorded rather than inventing it','Test QR is displayed but deliberately not registered as a real inspection']}
(root/'scripts/report-validation-results.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
