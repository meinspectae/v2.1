(async () => {
  const React = (await import('/node_modules/.vite/deps/react.js')).default;
  const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const { default: ReportDocument } = await import('/src/components/ReportDocument.tsx');
  const { renderReportPDF, prepareReportLayout } = await import('/src/utils/reportPdf.ts');
  const source = document.createElement('div'); source.style.width='680.315px';document.body.append(source);
  const data = structuredClone(window.fixture);
  data.rooms = data.rooms.map(r=>({...r,items:r.items.map(i=>({...i,condition:i.condition?'good':null}))}));
  data.utilityMeters={electricity:{reading:'12345 kWh',photo:data.overallPhotos[0]}};
  const root=createRoot(source);root.render(React.createElement(ReportDocument,{inspection:data,reportHash:window.fixtureHash,qrCode:'',header:null,footer:null}));
  await new Promise(r=>setTimeout(r,300));
  if(!source.textContent.includes('No Fair / Issues items recorded.'))throw Error('No-findings line missing');
  if(!source.textContent.includes('12345 kWh'))throw Error('Meter reading absent');
  const {clone,host}=await prepareReportLayout(source);
  const meter=[...clone.querySelectorAll('[data-report-block]')].find(b=>b.textContent.includes('12345 kWh'));
  if(!meter.querySelector('[data-evidence]'))throw Error('Meter photo absent');
  host.remove();root.unmount();source.remove();
  return {noFindings:'PASS',filledMeterValueAndPhoto:'PASS'};
})()
