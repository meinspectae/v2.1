(async () => {
const {useInspectionStore}=await import('/src/store/inspectionStore.ts');
const {client}=await import('/src/api/client.ts');
const {renderReportPDF}=await import('/src/utils/reportPdf.ts');
client.api.fetch=async path=>new Response(JSON.stringify(path.endsWith('/photos')?{photos:[]}:{data:{paymentData:'{"paid":true}'},success:true}));
const photos=[];
for(let n=0;n<32;n++){
 const c=document.createElement('canvas');c.width=2000;c.height=1500;const ctx=c.getContext('2d');const data=ctx.createImageData(2000,1500);let seed=n+17;
 for(let k=0;k<data.data.length;k+=4){seed=(seed*1664525+1013904223)>>>0;const v=seed>>>24;data.data[k]=v;data.data[k+1]=(v+n*5)%256;data.data[k+2]=(v+n*11)%256;data.data[k+3]=255;}
 ctx.putImageData(data,0,0);ctx.fillStyle='#fff';ctx.fillRect(150,100,1200,140);ctx.fillStyle='#000';ctx.font='70px sans-serif';ctx.fillText('Evidence detail '+n,170,195);ctx.strokeStyle='#c00';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(300,300);ctx.lineTo(1600,1100);ctx.stroke();
 photos.push({id:'stress-'+n,url:URL.createObjectURL(await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.78))),cloudPath:'photos/qa/'+n+'.jpg',backupStatus:'backed_up',timestamp:new Date().toISOString()});c.width=0;c.height=0;
}
const s=useInspectionStore.getState();const before=s.currentInspection;
s.setCurrentInspection({...before,rooms:[{id:'stress-room',name:'32 Photo Stress Room',type:'living',icon:'',overallComments:'',overallCondition:null,items:Array.from({length:16},(_,n)=>({id:'stress-item-'+n,name:'Evidence '+n,category:'test',condition:n===0?'fair':n===1?'poor':'good',comments:'Three-pixel scratch and text detail',checked:true,photos:photos.slice(n*2,n*2+2)}))}],overallPhotos:[],deletedItemIds:[],deletedRoomIds:[]});
await new Promise(r=>setTimeout(r,1500));
const progress=[];const blob=await renderReportPDF(document.getElementById('report-content'),m=>progress.push(m));
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='phase1-stress.pdf';a.id='qa-stress-download';a.textContent='QA PDF';document.body.append(a);
return {result:blob.size<=40*1024*1024?'PASS':'FAIL',pdfBytes:blob.size,pdfMB:(blob.size/1024/1024).toFixed(2),strongerPass:progress.some(m=>m.startsWith('Automatically')),photoCount:32,localPhotoBytes:localStorage.getItem('propinspect-storage').includes('data:image')};
})()
