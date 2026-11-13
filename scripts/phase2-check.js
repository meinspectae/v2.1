(async () => {
const { useInspectionStore } = await import('/src/store/inspectionStore.ts');
const { reportContentHash, sha256 } = await import('/src/utils/reportVerification.ts');
const { reportLegal } = await import('/src/config/reportLegal.ts');
const state = useInspectionStore.getState();
const before = state.currentInspection;
let text = document.getElementById('report-content').innerText;
if (text.includes('Utility meters') || text.includes('Move-in comparison')) throw Error('Empty optional section rendered');
if (reportLegal.en.clauses.length !== 19 || reportLegal.ar.clauses.length !== 19) throw Error('Clause mismatch');
const hash = await reportContentHash(before);
if (hash.length !== 64 || hash === await reportContentHash({...before, generalNotes:'Changed note'})) throw Error('Content hash does not cover notes');
state.updateOptionalDetails({utilityMeters:{electricity:{reading:'123 kWh'}},moveInReference:{keys:'2',cards:'1',defects:'Old wall scratch',newDefects:'Broken light'}});
await new Promise(r=>setTimeout(r,600));
text = document.getElementById('report-content').innerText;
if (!text.includes('123 kWh') || !text.includes('Old wall scratch') || !text.includes('Broken light') || !text.includes('at move-in: 2')) throw Error('Optional data missing');
const ar = document.querySelector('[lang="ar"]');
if(getComputedStyle(ar).direction !== 'rtl' || !getComputedStyle(ar).fontFamily.includes('Noto Naskh Arabic')) throw Error('Arabic font/direction missing');
state.updateOptionalDetails({utilityMeters:{},moveInReference:{}});
await new Promise(r=>setTimeout(r,500));
if(document.getElementById('report-content').innerText.includes('Move-in comparison')) throw Error('Cleared baseline still rendered');
return {optionalOmission:'PASS',optionalValues:'PASS',clauses:'19 English / 19 Arabic',rtlFont:'PASS',fullContentHash:'PASS',hash};
})()
