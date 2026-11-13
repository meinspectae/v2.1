import type { Inspection } from '../types';
import { reportLegal } from '../config/reportLegal';

export function ReportDisclaimer() {
  return <section data-report-legal>
    <div data-report-block data-page-start data-keep-next style={{ padding: '0 0 10px', display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563eb', marginBottom: 0 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>{reportLegal.en.heading}</h2>
      <h2 lang="ar" dir="rtl" style={{ fontSize: 18 }}>{reportLegal.ar.heading}</h2>
    </div>
    {reportLegal.sections.map(section => <div key={section.id}>
      <div data-report-block data-keep-next style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: '#eff6ff', padding: '5px 7px', fontSize: 11, fontWeight: 700 }}>
        <h3>{section.en}</h3><h3 lang="ar" dir="rtl">{section.ar}</h3>
      </div>
      {reportLegal.en.clauses.filter(([id]) => id.startsWith(section.id)).map(([id, text]) => <div key={id} data-report-block data-pdf-keep data-clause={id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, borderBottom: '1px solid #e2e8f0', padding: '1.5px 7px' }}>
        <div style={{ display: 'flex', gap: 5, fontSize: 9.5, lineHeight: 1.3 }}><strong style={{ flexShrink: 0 }}>{id}</strong><p>{text}</p></div>
        <div lang="ar" dir="rtl" style={{ display: 'flex', gap: 5, fontSize: 11, lineHeight: 1.35 }}><strong dir="ltr" style={{ flexShrink: 0, fontFamily: 'Inter', fontSize: 10 }}>{id}</strong><p>{reportLegal.ar.clauses.find(([key]) => key === id)?.[1]}</p></div>
      </div>)}
    </div>)}
  </section>;
}

export function ReportDeclaration() {
  return <div data-pdf-keep style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: 14, marginBottom: 16 }}>
    <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{reportLegal.en.declarationHeading}</h3>
    <p style={{ fontSize: 9, lineHeight: 1.7 }}>{reportLegal.en.declaration}</p>
    <div lang="ar" dir="rtl" className="arabic-text" style={{ marginTop: 12 }}><h3 style={{ fontSize: 13, fontWeight: 700 }}>{reportLegal.ar.declarationHeading}</h3><p style={{ fontSize: 11, lineHeight: 1.7 }}>{reportLegal.ar.declaration}</p></div>
  </div>;
}

export function hasMoveInReference(inspection: Inspection) {
  const r = inspection.moveInReference;
  return !!r && !!(r.attachment || r.keys?.trim() || r.cards?.trim() || r.defects?.trim() || r.newDefects?.trim());
}
export function ReportOptionalSections({ inspection, header }: { inspection: Inspection; header: React.ReactNode }) {
  const meters = Object.entries(inspection.utilityMeters || {}).filter(([, m]) => m.reading?.trim() || m.photo);
  const reference = inspection.moveInReference;
  const labels: Record<string, string> = { electricity: 'Electricity', water: 'Water', gasCooling: 'Gas / cooling' };
  const nowKeys = inspection.propertyItems.find(i => i.id === 'keys')?.value;
  const nowCards = inspection.propertyItems.find(i => i.id === 'access_cards')?.value;
  const propertyItems = inspection.propertyItems.filter(item => item.value?.trim() || item.comments?.trim());
  return <>
    {propertyItems.length > 0 && <div>{header}<section style={{ padding: '20px 40px', fontSize: 11, lineHeight: 1.7 }}><h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15 }}>Keys and recorded property details</h2>{propertyItems.map(item => <p data-pdf-keep key={item.id} style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}><strong>{item.name}: </strong>{item.value}{item.comments && ` — ${item.comments}`}</p>)}</section></div>}
    {meters.length > 0 && <div>{header}<section style={{ padding: '20px 40px' }}><h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15 }}>Utility meters</h2>
      {meters.map(([key, m]) => <div data-pdf-keep key={key} style={{ marginBottom: 16 }}><h3 style={{ fontSize: 12, fontWeight: 700 }}>{labels[key] || key}{m.reading.trim() ? `: ${m.reading}` : ''}</h3>{m.photo?.url && <div data-evidence={m.photo.url} style={{ width: 300, height: 210, backgroundImage: `url(${m.photo.url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />}</div>)}
    </section></div>}
    {hasMoveInReference(inspection) && <div>{header}<section style={{ padding: '20px 40px', fontSize: 11, lineHeight: 1.7 }}><h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15 }}>Move-in comparison</h2>
      {reference?.attachment && <p>Move-in report attached: {reference.attachment.name}. Reference retained with the inspection; contents not automatically interpreted.</p>}
      {reference?.keys?.trim() && <p>Keys — at move-in: {reference.keys}; now: {nowKeys || 'Not recorded'}</p>}
      {reference?.cards?.trim() && <p>Access cards — at move-in: {reference.cards}; now: {nowCards || 'Not recorded'}</p>}
      {reference?.defects?.trim() && <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}><strong>Pre-existing defects: </strong>{reference.defects}</p>}
      {reference?.newDefects?.trim() && <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}><strong>New defects identified by inspector: </strong>{reference.newDefects}</p>}
      {!reference?.newDefects?.trim() && <p style={{ marginTop: 12 }}>Current Fair / Issues findings are listed after the summary. Their age is not inferred from the reference.</p>}
    </section></div>}
  </>;
}
