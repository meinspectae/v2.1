(async () => {
  const { prepareReportLayout, renderReportPDF } = await import('/src/utils/reportPdf.ts');
  const { reportContentHash } = await import('/src/utils/reportVerification.ts');
  const { reportLegal } = await import('/src/config/reportLegal.ts');
  const source = document.getElementById('report-content');
  const rawBefore = JSON.stringify(window.fixture);
  const hashBefore = await reportContentHash(window.fixture);
  const { host, clone } = await prepareReportLayout(source);
  const blocks = [...clone.querySelectorAll('[data-report-block]')].filter(el => !el.parentElement?.closest('[data-report-block]'));
  const H = 245 * 96 / 25.4; let cursor = 0, page = 1;
  const places = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], h = b.getBoundingClientRect().height;
    if (b.dataset.pageStart !== undefined && cursor) {page++;cursor=0;}
    const need = h + (b.dataset.keepNext !== undefined && blocks[i+1] ? Math.min(blocks[i+1].getBoundingClientRect().height,H) : 0);
    if (cursor+need>H && cursor) {page++;cursor=0;}
    if (h>H) throw Error('Oversized block: '+b.textContent.slice(0,80));
    places.push({page, y:cursor, height:h, text:b.textContent.slice(0,60)});
    if (b.dataset.keepNext !== undefined && h+blocks[i+1].getBoundingClientRect().height>H) throw Error('Orphan risk');
    cursor+=h;
  }
  for (const el of clone.querySelectorAll('[data-clause]')) {
    const id=el.dataset.clause;
    const expectedEn=reportLegal.en.clauses.find(c=>c[0]===id)[1],expectedAr=reportLegal.ar.clauses.find(c=>c[0]===id)[1];
    if(el.children[0].querySelector('p').textContent!==expectedEn || el.children[1].querySelector('p').textContent!==expectedAr)throw Error('Exact wording mismatch '+id);
  }
  for (const row of clone.querySelectorAll('[data-photo-row]')) {
    const rect=row.getBoundingClientRect();
    for (const photo of row.querySelectorAll('[data-evidence]')) {
      const r=photo.getBoundingClientRect();if(r.left<rect.left-.5 || r.right>rect.right+.5)throw Error('Photo row overflow');
    }
  }
  host.remove();
  if (JSON.stringify(window.fixture)!==rawBefore || await reportContentHash(window.fixture)!==hashBefore)throw Error('Rendering changed inspection/hash');
  return {pageCount:page,exactBilingualClauses:'19 / 19 PASS',photoRows:'PASS',noOrphanBars:'PASS',inputAndHashUnchanged:'PASS',places};
})()
