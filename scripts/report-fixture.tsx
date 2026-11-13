import React from 'react';
import { createRoot } from 'react-dom/client';
import ReportDocument from '../src/components/ReportDocument';
import { PageHeader, PageFooter } from '../src/pages/ReportPage';
import { renderReportPDF, prepareReportLayout } from '../src/utils/reportPdf';
import { normalizeInspection, inspectionSummary } from '../src/utils/inspectionData';
import { reportContentHash, verificationId, verificationURL } from '../src/utils/reportVerification';
import { reportLegal } from '../src/config/reportLegal';
import QRCode from 'qrcode';
import type { ConditionRating, Inspection, InspectionItem, Photo, PropertyItem, Room } from '../src/types';
import '../src/index.css';

const w = window as any;
const baseTime = '2026-10-09T09:12:00+04:00';
const root = createRoot(document.getElementById('root')!);
const asset = (name: string) => `/sample-report-assets/${name}.jpg`;

let photoIndex = 0;
function photo(name: string, minutes: number, caption: string): Photo {
  photoIndex += 1;
  return {
    id: `sample-photo-${photoIndex}`,
    url: asset(name),
    timestamp: new Date(Date.parse(baseTime) + minutes * 60_000).toISOString(),
    gpsLat: 25.081742,
    gpsLng: 55.144619,
    caption,
    backupStatus: 'backed_up',
    cloudPath: `sample-only/${name}-${photoIndex}.jpg`,
  };
}

function item(id: string, name: string, condition: ConditionRating, comments: string, photos: Photo[] = []): InspectionItem {
  return { id, name, category: 'condition', condition, comments, photos, checked: true };
}

function room(id: string, name: string, type: string, overallComments: string, items: InspectionItem[]): Room {
  return { id, name, type, icon: '', overallComments, overallCondition: null, items };
}

function propertyItem(id: string, name: string, value: string, comments: string, photos: Photo[]): PropertyItem {
  return { id, name, value, comments, photos };
}

function signatureData(label: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(25, 112);
  ctx.bezierCurveTo(78, 15, 118, 145, 172, 54);
  ctx.bezierCurveTo(210, 12, 242, 125, 312, 67);
  ctx.bezierCurveTo(350, 35, 392, 109, 485, 70);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(label, 30, 145);
  return canvas.toDataURL('image/png');
}

w.generateFixture = async () => {
  photoIndex = 0;
  const livingWide = photo('living-room', 2, 'Living room overview');
  const livingWall = photo('wall-crack', 4, 'Hairline crack beside balcony opening');
  const kitchenWide = photo('kitchen', 12, 'Kitchen overview');
  const bedroomWide = photo('bedroom', 23, 'Primary bedroom overview');
  const bathroomWide = photo('bathroom', 35, 'Bathroom overview');
  const balconyWide = photo('balcony-exterior', 43, 'Balcony and surrounding towers');
  const breaker = photo('breaker-panel', 51, 'Electrical distribution board');
  const water = photo('water-meter', 54, 'Water meter reading');
  const ac = photo('ac-thermostat', 57, 'Air-conditioning thermostat and vent');
  const keys = photo('keys-cards', 62, 'Keys, access cards and parking remote');

  const input: Inspection = {
    id: 'sample-20261009-dubai',
    propertyType: 'apartment',
    status: 'completed',
    property: {
      type: 'apartment',
      makaniNumber: '4523 7812 34',
      area: 'Dubai Marina',
      city: 'Dubai',
      buildingName: 'Marina Vista Residence — Sample',
      unitNumber: '1807',
      furnished: true,
      specialFeatures: ['Balcony', 'Marina view', 'Covered parking'],
      bedrooms: 2,
      bathrooms: 2,
      totalAreaSqft: 1285,
    },
    landlord: { name: 'Omar Hassan (Sample)', phone: '+971 50 555 0148', email: 'omar.hassan@example.test' },
    tenant: { name: 'Sofia Bennett (Sample)', phone: '+971 55 555 0286', email: 'sofia.bennett@example.test' },
    agent: { name: 'Nadia Karim (Sample)', phone: '+971 52 555 0364', email: 'nadia.karim@example.test', companyName: 'Harbour Homes Sample LLC', tradeLicenseNumber: 'CN-DUMMY-20481' },
    tenancy: { contractNumber: 'EJARI-SAMPLE-2026-10482', leaseStartDate: '2026-10-10', leaseEndDate: '2027-10-09' },
    rooms: [
      room('entrance', 'Entrance & Hallway', 'entrance', 'Entrance was clear and accessible. Minor cosmetic wear only.', [
        item('entry-door', 'Entrance door & frame', 'good', 'Door opens and closes normally; light scuffing at lower edge.'),
        item('entry-lock', 'Lock, handle & viewer', 'very_good', 'Hardware secure with no visible damage.'),
        item('hall-walls', 'Walls & paintwork', 'good', 'Small handling marks beside the console area.'),
        item('hall-floor', 'Floor finish & skirting', 'very_good', 'Tiles and skirting visually intact.'),
        item('hall-lights', 'Lighting & switches', 'good', 'Fittings visually intact; function not electrically tested.'),
      ]),
      room('living', 'Living & Dining Room', 'living', 'Bright room with good overall presentation. One visible hairline crack requires monitoring.', [
        item('living-walls', 'Walls & paintwork', 'fair', 'Hairline crack approximately 55 cm long beside the balcony opening; no moisture staining observed.', [livingWall]),
        item('living-ceiling', 'Ceiling & cornices', 'very_good', 'No visible staining, sagging or open joints.'),
        item('living-floor', 'Flooring & skirting', 'good', 'Minor normal-use marks near dining chairs.', [livingWide]),
        item('living-windows', 'Windows & glazing', 'very_good', 'Glazing intact and frames visibly clean.'),
        item('living-balcony-door', 'Balcony door & track', 'good', 'Track shows light dust and wear; glass intact.'),
        item('living-electrical', 'Sockets, switches & lighting', 'good', 'Covers secure; operational testing outside inspection scope.'),
        item('living-furniture', 'Furniture & soft furnishings', 'very_good', 'Sofa, dining set and TV console present without obvious damage.'),
        item('living-ac', 'Air-conditioning outlets', 'good', 'Outlet covers clean; cooling performance not tested.', [ac]),
      ]),
      room('kitchen', 'Kitchen', 'kitchen', 'Kitchen was clean and serviceable in appearance. Appliances were recorded visually only.', [
        item('kitchen-cabinets', 'Cabinets, doors & handles', 'good', 'Minor rubbing to one lower cabinet edge; hinges visually aligned.', [kitchenWide]),
        item('kitchen-worktop', 'Worktop & splashback', 'very_good', 'No chips or open joints observed.'),
        item('kitchen-sink', 'Sink, tap & sealant', 'good', 'Light water spotting; sealant visually intact.'),
        item('kitchen-hob', 'Hob & extractor', 'good', 'Clean appearance; appliances not function-tested.'),
        item('kitchen-oven', 'Oven & microwave', 'very_good', 'Appliance fronts clean with no visible damage.'),
        item('kitchen-fridge', 'Refrigerator', 'good', 'Minor cosmetic mark on lower right door.'),
        item('kitchen-floor', 'Flooring & skirting', 'very_good', 'Tiles intact and grout generally clean.'),
        item('kitchen-electrical', 'Sockets & isolators', 'good', 'Faceplates secure; electrical function not tested.'),
      ]),
      room('bedroom-one', 'Primary Bedroom', 'bedroom', 'Room presented in good condition with normal signs of occupancy.', [
        item('bed1-walls', 'Walls & paintwork', 'good', 'Two faint furniture rub marks behind bedside table.', [bedroomWide]),
        item('bed1-ceiling', 'Ceiling', 'very_good', 'No visible staining or cracking.'),
        item('bed1-floor', 'Flooring & skirting', 'good', 'Carpet clean with slight pile flattening at bedside.'),
        item('bed1-wardrobe', 'Wardrobes & mirrors', 'very_good', 'Doors aligned; mirrors free from cracks.'),
        item('bed1-window', 'Window & blinds', 'good', 'Window frame clean; blinds show minor creasing.'),
        item('bed1-furniture', 'Bed & furniture', 'very_good', 'Bed frame and bedside units visually intact.'),
      ]),
      room('bedroom-two', 'Bedroom 2 / Study', 'bedroom', 'Used as a study and guest room; no significant defects noted.', [
        item('bed2-walls', 'Walls & paintwork', 'very_good', 'Even finish with no obvious damage.'),
        item('bed2-floor', 'Flooring & skirting', 'good', 'Small surface mark close to desk position.'),
        item('bed2-wardrobe', 'Wardrobe', 'very_good', 'Interior shelves and sliding doors visually intact.'),
        item('bed2-window', 'Window & blind', 'very_good', 'No visible glass or frame damage.'),
        item('bed2-electrical', 'Sockets, switches & lighting', 'good', 'Faceplates secure; function not tested.'),
      ]),
      room('bathroom-one', 'Primary Bathroom', 'bathroom', 'Bathroom was clean. Localised wear to shower sealant should be renewed as routine maintenance.', [
        item('bath1-vanity', 'Vanity, basin & tap', 'very_good', 'Surfaces clean and free from visible chips.', [bathroomWide]),
        item('bath1-shower', 'Shower enclosure & fittings', 'good', 'Glass and metalwork intact.'),
        item('bath1-sealant', 'Sealant & grout', 'fair', 'Light discolouration and wear at lower shower corner; renewal recommended.'),
        item('bath1-toilet', 'Toilet & flush plate', 'very_good', 'No visible chips or cracks; function not tested.'),
        item('bath1-walls', 'Wall and floor tiles', 'very_good', 'No cracked tiles observed.'),
        item('bath1-vent', 'Ventilation & lighting', 'good', 'Covers clean; extraction performance not tested.'),
      ]),
      room('bathroom-two', 'Guest Bathroom', 'bathroom', 'Good visual condition with minor normal-use wear.', [
        item('bath2-vanity', 'Vanity, basin & tap', 'good', 'Minor water spotting at tap base.'),
        item('bath2-shower', 'Shower enclosure', 'very_good', 'Glass and hardware visibly intact.'),
        item('bath2-sealant', 'Sealant & grout', 'good', 'Slight age-related colour variation.'),
        item('bath2-toilet', 'Toilet', 'very_good', 'No visible damage.'),
        item('bath2-tiles', 'Wall and floor tiles', 'very_good', 'Tiles visually intact.'),
      ]),
      room('balcony', 'Balcony', 'balcony', 'Balcony accessible with clear drainage points and unobstructed view.', [
        item('balcony-floor', 'Floor tiles & drainage', 'good', 'Light outdoor dust and minor weathering; no standing water.', [balconyWide]),
        item('balcony-railing', 'Glass railing & handrail', 'very_good', 'Panels visibly intact and handrail secure in appearance.'),
        item('balcony-walls', 'Walls & soffit', 'good', 'Minor environmental dust; no significant staining.'),
        item('balcony-light', 'External light', 'good', 'Fitting visually intact; function not tested.'),
      ]),
    ],
    propertyItems: [
      propertyItem('keys', 'Keys', '2 apartment keys', 'Both keys photographed and handed over.', [keys]),
      propertyItem('access_cards', 'Access cards', '2 building access cards', 'Generic sample cards; identifiers intentionally omitted.', [keys]),
      propertyItem('parking_remote', 'Parking remote', '1 remote', 'Recorded with keys and access cards.', [keys]),
      propertyItem('parking_bay', 'Parking bay', 'B2-118', 'Bay number supplied as dummy data; not independently verified.', []),
    ],
    utilityMeters: {
      electricity: { reading: 'DEWA sample reading: 018742 kWh', photo: breaker },
      water: { reading: 'Sample reading: 00391 m³', photo: water },
      gasCooling: { reading: 'District cooling meter: 001284 RT-h', photo: ac },
    },
    moveInReference: {
      keys: '2 apartment keys and 2 access cards',
      cards: '2 access cards and 1 parking remote',
      defects: 'Move-in reference noted minor paint marks in the hallway and light wear at the kitchen cabinet edge.',
      newDefects: 'Hairline crack beside the living-room balcony opening and worn shower sealant were recorded during this sample inspection.',
      attachment: { path: 'sample-only/move-in-reference.pdf', name: 'Sample Move-in Record.pdf' },
    },
    generalNotes: 'SAMPLE REPORT — All names, contact details, identifiers, readings and signatures are fictional. Stock images are used to emulate a realistic completed property condition inspection. This document is for website demonstration and upload testing only, and must not be relied upon for any real property or tenancy decision.',
    overallPhotos: [balconyWide, livingWide, kitchenWide, bedroomWide, bathroomWide],
    signatures: [
      { role: 'landlord', name: 'Omar Hassan (Sample)', dataUrl: signatureData('O. Hassan — sample', '#1e3a5f'), signedAt: '2026-10-09T10:22:00+04:00', ipAddress: '192.0.2.41' },
      { role: 'tenant', name: 'Sofia Bennett (Sample)', dataUrl: signatureData('S. Bennett — sample', '#2563eb'), signedAt: '2026-10-09T10:24:00+04:00', ipAddress: '198.51.100.27' },
      { role: 'inspector', name: 'Layla Rahman (Sample Inspector)', dataUrl: signatureData('L. Rahman — sample', '#0f766e'), signedAt: '2026-10-09T10:26:00+04:00', ipAddress: '203.0.113.18' },
    ],
    createdAt: '2026-10-09T09:00:00+04:00',
    updatedAt: '2026-10-09T10:28:00+04:00',
    completedAt: '2026-10-09T10:28:00+04:00',
    meta: {
      inspectorId: 'sample-inspector-001',
      inspectorName: 'Layla Rahman (Sample Inspector)',
      inspectorEmail: 'layla.rahman@example.test',
      ipAddress: '203.0.113.18',
      location: { latitude: 25.081742, longitude: 55.144619, address: 'Dubai Marina, Dubai', accuracy: 8 },
      deviceInfo: 'Sample inspection device',
      appVersion: '2026.10-demo',
    },
    reportGenerated: true,
  };

  (input as Inspection & { inspectionType: string }).inspectionType = 'Move-in condition inspection (sample)';
  const inspection = normalizeInspection(input);
  w.fixture = inspection;
  const hash = await reportContentHash(inspection);
  w.fixtureHash = hash;
  const qr = await QRCode.toDataURL(verificationURL(verificationId(inspection.id, hash)), { width: 240, margin: 2, errorCorrectionLevel: 'M' });
  const header = <PageHeader inspection={inspection} reportHash={hash} />;
  const footer = <PageFooter inspection={inspection} pageNumber={1} />;
  root.render(<div id="report-content" style={{ width: '680.315px', margin: '20px auto' }}><ReportDocument inspection={inspection} reportHash={hash} qrCode={qr} header={header} footer={footer} /></div>);

  await new Promise(resolve => setTimeout(resolve, 700));
  await document.fonts.load('400 12px Inter');
  await document.fonts.load('700 12px Inter');
  await document.fonts.load('400 12px "Noto Naskh Arabic"');
  const source = document.getElementById('report-content')!;
  const required = ['Keys & Access Cards', 'Utility Meter Readings', 'Move-in comparison', 'Fair / Issues items', 'Legal Declaration', reportLegal.en.heading, 'SAMPLE REPORT'];
  for (const text of required) if (!source.textContent!.includes(text)) throw new Error(`Missing sample section: ${text}`);
  if (source.querySelectorAll('[data-clause]').length !== 19) throw new Error('Wrong clause count');
  const sum = inspectionSummary(inspection);
  if (sum.rated !== sum.good + sum.fair + sum.issues) throw new Error('Condition counts do not add up');
  if (sum.photos < 10) throw new Error('Sample report does not contain enough evidence photos');
  const { host, clone } = await prepareReportLayout(source);
  w.layoutMetrics = { blocks: clone.querySelectorAll('[data-report-block]').length, evidence: clone.querySelectorAll('[data-evidence]').length };
  host.remove();

  const blob = await renderReportPDF(source, status => { w.progress = status; });
  w.fixturePdf = blob;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.id = 'download-report';
  link.download = 'MeInspect-Sample-Condition-Report-New-Format-2026-10-09.pdf';
  link.textContent = 'Download sample condition report';
  document.body.prepend(link);
  return { bytes: blob.size, photoCount: sum.photos, rooms: inspection.rooms.length, ratedItems: sum.rated, findings: sum.findings.length, clauses: 19, checks: 'All report sections, dummy data, stock images and signatures included' };
};
w.ready = true;
