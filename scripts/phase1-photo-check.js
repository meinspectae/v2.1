(async () => {
const { useInspectionStore } = await import('/src/store/inspectionStore.ts');
const { client } = await import('/src/api/client.ts');
const { compressPhoto } = await import('/src/utils/compression.ts');
const { renderReportPDF } = await import('/src/utils/reportPdf.ts');
client.api.fetch = async path => new Response(JSON.stringify(path.endsWith('/photos') ? { photos: [] } : { data: { paymentData: '{"paid":true}' }, success: true }));
const c = document.createElement('canvas'); c.width = 3200; c.height = 2400;
const ctx = c.getContext('2d'); ctx.fillStyle = '#e0dacd';ctx.fillRect(0,0,c.width,c.height);
ctx.strokeStyle='#36312a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(700,400);ctx.lineTo(1800,1800);ctx.lineTo(2500,2050);ctx.stroke();
ctx.fillStyle='#806345';ctx.font='90px sans-serif';ctx.fillText('Scratch evidence detail',300,200);
const url = await compressPhoto(c.toDataURL('image/jpeg',0.95));
const image = new Image();image.src=url;await image.decode();
if(image.width !== 2000 || image.height !== 1500) throw new Error('Compression dimensions wrong');
const store = useInspectionStore.getState();
const before = store.currentInspection;
const photo = n => ({id:'qa-photo-'+n,url,cloudPath:'photos/qa/'+n+'.jpg',backupStatus:'backed_up',timestamp:new Date().toISOString()});
const items = Array.from({length:16},(_,n)=>({id:'evidence-'+n,name:'Evidence '+n,category:'test',condition:n===0?'fair':n===1?'poor':'good',checked:true,comments:'Fine scratch visible in the full-resolution image',photos:[photo(n*2),photo(n*2+1)]}));
store.setCurrentInspection({...before, rooms:[{id:'evidence-room',name:'Evidence room',type:'living',icon:'',overallCondition:null,overallComments:'',items}],overallPhotos:[],deletedRoomIds:[],deletedItemIds:[]});
await new Promise(r=>setTimeout(r,1000));
if(localStorage.getItem('propinspect-storage').includes('data:image')) throw new Error('Photo data leaked into localStorage');
const report=document.getElementById('report-content');
const blob=await renderReportPDF(report,()=>{});
window.__qaPDF=blob;
window.__qaPhotoUrl=url;
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='phase1-32-photos.pdf';a.textContent='Download QA PDF';a.id='qa-pdf-download';document.body.append(a);
return {photos:32,pdfBytes:blob.size,pdfMB:(blob.size/1024/1024).toFixed(2),maxEdge:2000,localMetadataBytes:localStorage.getItem('propinspect-storage').length,result:'PASS'};
})()
