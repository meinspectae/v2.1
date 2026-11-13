import type { CSSProperties, ReactNode } from 'react';
import type { Inspection, InspectionItem, Photo, Room } from '../types';
import { getConditionLabel, getPropertyTypeLabel } from '../data/propertyTemplates';
import { earliestPhotoTimestamp, earliestReportPhoto, inspectionSummary, isRated } from '../utils/inspectionData';
import { formatDate, formatDateTime } from '../utils/helpers';
import { reportLegal, reportRatingDefinitions } from '../config/reportLegal';
import { ReportDisclaimer, ReportDeclaration, hasMoveInReference } from './ReportQualitySections';
import { verificationId, verificationURL } from '../utils/reportVerification';
import '../styles/report.css';

const px = (mm: number) => `${mm * 96 / 25.4}px`;
const brand = '#2563eb';
const card: CSSProperties = { background: '#f8fafc', borderLeft: `${px(2)} solid ${brand}`, padding: `${px(2)} ${px(3)}`, borderRadius: px(2) };
const roomArabic: Record<string, string> = { living: 'غرفة المعيشة', living_room: 'غرفة المعيشة', kitchen: 'المطبخ', bedroom: 'غرفة النوم', bathroom: 'الحمام', balcony: 'الشرفة', entrance: 'المدخل', hallway: 'الممر', dining: 'غرفة الطعام', dining_room: 'غرفة الطعام', laundry: 'غرفة الغسيل', storage: 'المخزن', parking: 'موقف السيارات', outdoor: 'المساحة الخارجية', office: 'المكتب', reception: 'الاستقبال', meeting_room: 'غرفة الاجتماعات', other: 'غرفة أخرى' };
const arRoom = (room: Room) => (room as Room & { nameAr?: string }).nameAr || roomArabic[room.type] || roomArabic[room.name.toLowerCase().replaceAll(' ', '_')] || 'غرفة';
const ratings = ['very_good', 'good', 'fair', 'poor'] as const;

export function RatingPill({ condition, count }: { condition: NonNullable<InspectionItem['condition']>; count?: number }) {
  const definition = reportRatingDefinitions[condition];
  return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: definition.background, color: definition.color, borderRadius: 12, padding: '2px 7px', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>
    <span>{count !== undefined ? `${getConditionLabel(condition)} ${count}` : getConditionLabel(condition)}</span>{count === undefined && <><span>/</span><span lang="ar" dir="rtl">{definition.ar}</span></>}
  </span>;
}
export function PhotoFrame({ photo, kind = 'standard' }: { photo: Photo; kind?: 'standard' | 'cover' | 'thumbnail' }) {
  if (!photo.url) return null;
  const w = kind === 'cover' ? 90 : kind === 'thumbnail' ? 25 : 50;
  const h = kind === 'cover' ? 120 : kind === 'thumbnail' ? 20 : 66;
  return <div data-photo-wrap style={{ width: px(w), flexShrink: 0 }}>
    <div data-evidence={photo.url} data-photo-id={photo.id} data-photo-kind={kind} style={{ width: px(w), height: px(h), border: '0.6px solid #d1d5db', borderRadius: px(2), backgroundColor: '#f1f5f9', backgroundImage: `url(${photo.url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
    {kind !== 'thumbnail' && photo.timestamp && <p style={{ fontSize: '8pt', color: '#64748b', textAlign: 'center', lineHeight: 1.35, paddingTop: 4 }}>{formatDateTime(photo.timestamp)}</p>}
  </div>;
}
function Photos({ photos }: { photos: Photo[] }) {
  return <div data-photo-flow style={{ display: 'flex', flexWrap: 'wrap', gap: px(3), width: '100%' }}>{photos.filter(p => p.url && p.includeInReport !== false).map(photo => <PhotoFrame key={photo.id} photo={photo} />)}</div>;
}
function Bar({ en, ar, start = false }: { en: string; ar: string; start?: boolean }) {
  return <div data-report-block data-keep-next {...(start ? { 'data-page-start': '' } : {})} style={{ paddingTop: px(3), paddingBottom: px(2) }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: brand, color: '#fff', padding: '7px 12px', borderRadius: 3 }}><h2 style={{ fontSize: 13, fontWeight: 700 }}>{en}</h2><h2 lang="ar" dir="rtl" style={{ fontSize: 15 }}>{ar}</h2></div>
  </div>;
}
function Detail({ label, ar, value }: { label: string; ar: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null;
  return <div style={{ paddingBottom: 4, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, color: '#64748b', fontSize: 8, lineHeight: 1.3 }}><span>{label}</span><span lang="ar" dir="rtl">{ar}</span></div><div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{value}</div></div>;
}
function DetailsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div style={{ paddingBottom: 7 }}><h3 style={{ color: brand, fontWeight: 700, fontSize: 10, borderBottom: '1px solid #dbeafe', paddingBottom: 3, marginBottom: 4 }}>{title}</h3>{children}</div>;
}
function Breakdown({ items }: { items: InspectionItem[] }) {
  return <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{ratings.filter(r => items.some(i => i.condition === r)).map(r => <RatingPill key={r} condition={r} count={items.filter(i => i.condition === r).length} />)}</div>;
}
function ItemCard({ item, nested = false }: { item: InspectionItem; nested?: boolean }) {
  const photos = item.photos.filter(photo => photo.url && photo.includeInReport !== false);
  return <div {...(nested ? {} : { 'data-report-block': '', 'data-item-card': '', 'data-pdf-keep': '' })} style={{ paddingBottom: px(3), minWidth: 0 }}>
    <div style={{ ...card, height: '100%', boxSizing: 'border-box' }} data-card-content>
      <div data-card-heading style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingBottom: photos.length ? 3 : 0 }}><strong style={{ fontSize: 11 }}>{item.name}</strong><RatingPill condition={item.condition!} />{!photos.length && item.comments && <em style={{ fontSize: 10, color: '#64748b' }}>{item.comments}</em>}</div>
      {photos.length > 0 && item.comments && <p style={{ fontSize: 10, fontStyle: 'italic', color: '#64748b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.comments}</p>}
      {item.ratingHistory && item.ratingHistory.length > 1 && <p style={{ fontSize: 9, color: '#64748b' }}>Merged ratings retained: {item.ratingHistory.map(getConditionLabel).join(', ')}. Summary uses the most severe rating.</p>}
      {photos.length > 0 && <Photos photos={photos} />}
    </div>
  </div>;
}
function ItemCards({ items }: { items: InspectionItem[] }) {
  const blocks: ReactNode[] = [];
  let pair: InspectionItem[] = [];
  const flush = () => {
    if (!pair.length) return;
    const row = pair; pair = [];
    blocks.push(<div data-report-block data-pdf-keep key={`pair-${row.map(item => item.id).join('-')}`} style={{ display: 'grid', gridTemplateColumns: row.length === 2 ? '1fr 1fr' : '1fr', gap: px(3) }}>{row.map(item => <ItemCard key={item.id} item={item} nested />)}</div>);
  };
  for (const item of items) {
    const count = item.photos.filter(photo => photo.url && photo.includeInReport !== false).length;
    if (count >= 2) { flush(); blocks.push(<ItemCard key={item.id} item={item} />); }
    else { pair.push(item); if (pair.length === 2) flush(); }
  }
  flush();
  return <>{blocks}</>;
}

/** Presentation only. Receives the same normalized inspection and unchanged verification values. */
export default function ReportDocument({ inspection, reportHash, qrCode, header, footer }: { inspection: Inspection; reportHash: string; qrCode: string; header: ReactNode; footer: ReactNode }) {
  const summary = inspectionSummary(inspection);
  const rooms = inspection.rooms;
  const ratedItems = rooms.flatMap(r => r.items.filter(isRated));
  const reportGeneratedAt = inspection.completedAt || inspection.updatedAt;
  const inspectionStartedAt = earliestPhotoTimestamp(inspection) || reportGeneratedAt;
  const meters = Object.entries(inspection.utilityMeters || {}).filter(([, m]) => m.reading?.trim() || m.photo);
  const keys = inspection.propertyItems.filter(i => i.value?.trim() || i.comments?.trim() || i.photos?.length);
  const sigRoles = ['landlord', 'tenant', 'inspector'] as const;
  const signatures = sigRoles.map(role => inspection.signatures.find(s => s.role === role) || { role, name: role === 'inspector' ? inspection.meta.inspectorName : inspection[role]?.name, dataUrl: '', signedAt: '' });
  const coverPhoto = earliestReportPhoto(inspection);
  const propertyAddress = [inspection.property.buildingName, inspection.property.unitNumber && `Unit ${inspection.property.unitNumber}`, inspection.property.area, inspection.property.city].filter(Boolean).join(', ') || inspection.property.makaniNumber || 'Property address not recorded';
  const included = (photos: Photo[]) => photos.filter(photo => photo.url && photo.includeInReport !== false);
  return <article className="meinspect-report" style={{ width: '100%' }}>
    {header}
    <section data-report-block data-cover style={{ paddingBottom: 12 }}>
      <div style={{ textAlign: 'center', padding: '8px 0 12px' }}><h1 style={{ fontSize: 23, fontWeight: 700, color: '#1e3a5f' }}>Property Condition Report</h1><h2 lang="ar" dir="rtl" style={{ fontSize: 22, textAlign: 'center' }}>تقرير حالة العقار</h2><p style={{ fontSize: 11, color: '#64748b' }}>{formatDate(inspectionStartedAt)}</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #dbeafe', borderRadius: 7, background: '#eff6ff' }}>
        {[[rooms.filter(r => r.items.some(isRated)).length, 'Rooms inspected'], [summary.rated, 'Items rated'], [summary.photos, 'Photos captured']].map(([value, label]) => <div key={label} style={{ textAlign: 'center', padding: 8 }}><strong style={{ fontSize: 21, color: brand, display: 'block' }}>{value}</strong><span style={{ fontSize: 10 }}>{label}</span></div>)}
      </div>
      <p style={{ textAlign: 'center', fontSize: 10, color: '#475569', padding: '7px 0 4px' }}>Good {summary.good} | Fair {summary.fair} | Issues {summary.issues}</p>
      {summary.excludedPhotos > 0 && <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#b45309', paddingBottom: 8 }}>{summary.excludedPhotos} photos could not be included</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `${px(90)} 1fr`, gap: px(5) }}>
        <div>{coverPhoto ? <PhotoFrame photo={coverPhoto} kind="cover" /> : <div style={{ width: px(90), height: px(120), border: '1px solid #cbd5e1', borderRadius: px(2), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: px(8), background: '#f8fafc', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>{propertyAddress}</div>}</div>
        <div>
          <DetailsGroup title="Property details">
            <Detail label="Type" ar="النوع" value={getPropertyTypeLabel(inspection.propertyType)} />
            <Detail label="Building" ar="المبنى" value={inspection.property.buildingName} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Detail label="Unit" ar="الوحدة" value={inspection.property.unitNumber} /><Detail label="Makani" ar="مكاني" value={inspection.property.makaniNumber} /></div>
            <Detail label="Area" ar="المنطقة" value={inspection.property.area} /><Detail label="City" ar="المدينة" value={inspection.property.city} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Detail label="Area (sqft)" ar="المساحة" value={inspection.property.totalAreaSqft} /><Detail label="Furnished" ar="مفروش" value={inspection.property.furnished === undefined ? '' : inspection.property.furnished ? 'Yes' : 'No'} /><Detail label="Bedrooms" ar="غرف النوم" value={inspection.property.bedrooms} /><Detail label="Bathrooms" ar="الحمامات" value={inspection.property.bathrooms} /></div>
          </DetailsGroup>
          <DetailsGroup title="Tenancy details"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Detail label="Lease start" ar="بداية الإيجار" value={inspection.tenancy.leaseStartDate ? formatDate(inspection.tenancy.leaseStartDate) : ''} /><Detail label="Lease end" ar="نهاية الإيجار" value={inspection.tenancy.leaseEndDate ? formatDate(inspection.tenancy.leaseEndDate) : ''} /></div><Detail label="Contract" ar="العقد" value={inspection.tenancy.contractNumber} /></DetailsGroup>
          <DetailsGroup title="Inspection details"><Detail label="Inspector" ar="المفتّش" value={inspection.meta.inspectorName} /><Detail label="Started (first photo)" ar="وقت البدء (أول صورة)" value={formatDateTime(inspectionStartedAt)} />{(inspection as any).inspectionType && <Detail label="Inspection type" ar="نوع الفحص" value={(inspection as any).inspectionType} />}</DetailsGroup>
          {(['landlord', 'tenant'] as const).map(role => <DetailsGroup key={role} title={role === 'landlord' ? 'Landlord' : 'Tenant'}><Detail label="Name" ar="الاسم" value={inspection[role].name} /><Detail label="Phone" ar="الهاتف" value={inspection[role].phone} /><Detail label="Email" ar="البريد الإلكتروني" value={inspection[role].email} /></DetailsGroup>)}
        </div>
      </div>
    </section>
    <Bar en="Rating legend" ar="دليل التقييم" start />
    {ratings.map(r => <div data-report-block key={r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', minHeight: 31 }}><div style={{ width: 152, flexShrink: 0 }}><RatingPill condition={r} /></div><p style={{ fontSize: 10 }}>{reportRatingDefinitions[r].en}</p></div>)}
    <div data-table-title="overview"><Bar en="Inspection overview" ar="ملخص الفحص" /></div>
    <div data-report-block data-keep-next data-table-header="overview" style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, background: '#eff6ff', padding: '7px 8px', fontSize: 9, fontWeight: 700 }}><span>Room</span><span>Items rated</span><span>Photos</span><span>Condition breakdown</span></div>
    {rooms.map(room => <div data-report-block data-table-row="overview" key={room.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '7px 8px', fontSize: 10 }}><span>{room.name}</span><span>{room.items.filter(isRated).length || '—'}</span><span>{included(room.items.flatMap(i => i.photos)).length}</span><div>{room.items.some(isRated) ? <Breakdown items={room.items} /> : '—'}</div></div>)}
    {included(inspection.overallPhotos).length > 0 && <div data-report-block data-table-row="overview" style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, borderBottom: '1px solid #e2e8f0', padding: '7px 8px', fontSize: 10 }}><span>Property photos</span><span>—</span><span>{included(inspection.overallPhotos).length}</span><span>—</span></div>}
    {keys.some(item => included(item.photos).length) && <div data-report-block data-table-row="overview" style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, borderBottom: '1px solid #e2e8f0', padding: '7px 8px', fontSize: 10 }}><span>Keys &amp; Access Cards</span><span>—</span><span>{included(keys.flatMap(item => item.photos)).length}</span><span>—</span></div>}
    {meters.some(([, meter]) => meter.photo?.url && meter.photo.includeInReport !== false) && <div data-report-block data-table-row="overview" style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, borderBottom: '1px solid #e2e8f0', padding: '7px 8px', fontSize: 10 }}><span>Utility Meters</span><span>—</span><span>{meters.filter(([, meter]) => meter.photo?.url && meter.photo.includeInReport !== false).length}</span><span>—</span></div>}
    <div data-report-block data-table-row="overview" style={{ display: 'grid', gridTemplateColumns: '1.5fr .55fr .45fr 2.5fr', gap: 7, background: '#f1f5f9', padding: '7px 8px', fontSize: 10, fontWeight: 700 }}><span>Total (all photos)</span><span>{summary.rated}</span><span>{summary.photos}</span><Breakdown items={ratedItems} /></div>
    <div data-table-title="findings"><Bar en="Fair / Issues items" ar="العناصر المتوسطة أو ذات المشكلات" /></div>
    {summary.findings.length ? <>
      <div data-report-block data-keep-next data-table-header="findings" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.7fr 95px', gap: 8, fontSize: 9, fontWeight: 700, background: '#eff6ff', padding: 6 }}><span>Room</span><span>Item</span><span>Rating</span><span>Note</span><span>Photo</span></div>
      {summary.findings.map(({ room, item }) => <div data-report-block data-pdf-keep data-table-row="findings" key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.7fr 95px', gap: 8, padding: '5px 6px', borderBottom: '1px solid #e2e8f0', fontSize: 10, alignItems: 'center' }}><span>{room.name}</span><span>{item.name}</span><RatingPill condition={item.condition!} /><p style={{ whiteSpace: 'pre-wrap' }}>{item.comments || '—'}</p><div>{item.photos.find(p => p.url && p.includeInReport !== false) ? <PhotoFrame photo={item.photos.find(p => p.url && p.includeInReport !== false)!} kind="thumbnail" /> : '—'}</div></div>)}
    </> : <div data-report-block style={{ padding: 10, fontSize: 11 }}>No Fair / Issues items recorded. <span lang="ar" dir="rtl">لا توجد عناصر متوسطة أو ذات مشكلات مسجّلة.</span></div>}
    <ReportDisclaimer />
    {keys.length > 0 && <><Bar en="Keys & Access Cards" ar="المفاتيح وبطاقات الدخول" start />{keys.map(item => <div data-report-block data-item-card key={item.id} style={{ paddingBottom: px(3) }}><div style={card} data-card-content><div data-card-heading><h3 style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</h3><p style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{[item.value, item.comments].filter(Boolean).join(' — ')}</p></div><Photos photos={item.photos} /></div></div>)}</>}
    {meters.length > 0 && <><Bar en="Utility Meter Readings" ar="قراءات عدادات الخدمات" start={!keys.length} />{meters.map(([key, m]) => <div data-report-block key={key} style={{ paddingBottom: px(3) }}><div style={card}><h3 style={{ fontSize: 12, fontWeight: 700 }}>{({ electricity: 'Electricity', water: 'Water', gasCooling: 'Gas / cooling' } as Record<string, string>)[key] || key}</h3>{m.reading?.trim() && <p style={{ fontSize: 11 }}>{m.reading}</p>}{m.photo && <Photos photos={[m.photo]} />}</div></div>)}</>}
    {hasMoveInReference(inspection) && <><Bar en="Move-in comparison" ar="مقارنة بحالة الدخول" start={!keys.length && !meters.length} /><div data-report-block style={{ ...card, fontSize: 11 }}>
      {inspection.moveInReference?.attachment && <p>Move-in report attached: {inspection.moveInReference.attachment.name}. Reference retained with the inspection; contents not automatically interpreted.</p>}
      {inspection.moveInReference?.keys && <p>Keys — at move-in: {inspection.moveInReference.keys}; now: {inspection.propertyItems.find(i => i.id === 'keys')?.value || 'Not recorded'}</p>}
      {inspection.moveInReference?.cards && <p>Access cards — at move-in: {inspection.moveInReference.cards}; now: {inspection.propertyItems.find(i => i.id === 'access_cards')?.value || 'Not recorded'}</p>}
      {inspection.moveInReference?.defects && <p>Pre-existing defects: {inspection.moveInReference.defects}</p>}{inspection.moveInReference?.newDefects && <p>New defects identified by inspector: {inspection.moveInReference.newDefects}</p>}
    </div></>}
    {rooms.map((room, index) => <section key={room.id}><Bar en={room.name} ar={arRoom(room)} start={index === 0 && !keys.length && !meters.length && !hasMoveInReference(inspection)} />
      {room.items.some(isRated) ? <ItemCards items={room.items.filter(isRated)} /> : <div data-report-block style={{ padding: '9px 12px', fontSize: 11, color: '#64748b' }}>No items inspected in this room <span lang="ar" dir="rtl">لم يتم فحص أي عناصر في هذه الغرفة</span></div>}
      {room.overallComments && <div data-report-block style={{ ...card, fontSize: 10 }}><strong>Room Notes: </strong>{room.overallComments}</div>}
    </section>)}
    {inspection.overallPhotos.length > 1 && <><Bar en="Additional property photos" ar="صور إضافية للعقار" /><div data-report-block><Photos photos={inspection.overallPhotos.slice(1)} /></div></>}
    {inspection.generalNotes?.trim() && <><Bar en="General notes" ar="ملاحظات عامة" /><div data-report-block style={{ ...card, fontSize: 11, whiteSpace: 'pre-wrap' }}>{inspection.generalNotes}</div></>}
    <div data-report-block data-page-start style={{ paddingTop: 8 }}><ReportDeclaration /></div>
    <div data-report-block data-pdf-keep style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '8px 0 15px' }}>
      {signatures.map(sig => <div key={sig.role} style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: 10, background: '#fafafa', textAlign: 'center' }}><h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{sig.role === 'landlord' ? 'Landlord / المالك' : sig.role === 'tenant' ? 'Tenant / المستأجر' : 'Inspector / المفتّش'}</h3><p style={{ fontSize: 11, padding: '4px 0' }}>{sig.role === 'inspector' ? inspection.meta.inspectorName : sig.name}</p>
        {sig.dataUrl ? <div data-signature={sig.dataUrl} style={{ height: 65, width: '100%', backgroundImage: `url(${sig.dataUrl})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} /> : <div style={{ height: 65, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: '#b16b6b', fontSize: 10 }}><p>{reportLegal.en.unsigned}</p><p lang="ar" dir="rtl" style={{ textAlign: 'center', fontSize: 13 }}>{reportLegal.ar.unsigned}</p></div>}
        {sig.dataUrl && sig.signedAt && <p style={{ fontSize: 9, paddingTop: 6 }}>{formatDateTime(sig.signedAt)}</p>}
        {sig.dataUrl && sig.ipAddress && <p style={{ fontSize: 9, color: '#64748b', paddingTop: 4 }}>IP: {sig.ipAddress}</p>}
      </div>)}
    </div>
    <div data-report-block data-pdf-keep style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: 12, fontSize: 10 }}>
      <strong>Report ID: RPT-{inspection.id.slice(0, 8).toUpperCase()}</strong>
      {reportHash && <><p style={{ marginTop: 6 }}>Verification code: {verificationId(inspection.id, reportHash)}</p><p style={{ fontSize: 9, overflowWrap: 'anywhere', margin: '8px 0' }}>SHA-256 content hash: {reportHash}</p><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{qrCode && <img src={qrCode} alt="Scan to verify this report" style={{ width: 100, height: 100 }} />}<div style={{ flex: 1, minWidth: 0 }}><a href={verificationURL(verificationId(inspection.id, reportHash))} style={{ fontSize: 9, color: brand, overflowWrap: 'anywhere' }}>{verificationURL(verificationId(inspection.id, reportHash))}</a><p style={{ fontSize: 9, marginTop: 8 }}>The printed hash identifies the report content. Select the PDF on the verification page to check the final file.</p></div></div></>}
    </div>
    {footer}
  </article>;
}
