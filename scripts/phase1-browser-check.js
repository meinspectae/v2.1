(async () => {
const { useInspectionStore } = await import('/src/store/inspectionStore.ts');
const { useAuthStore } = await import('/src/store/authStore.ts');
const { client } = await import('/src/api/client.ts');
const { inspectionSummary, allPhotos } = await import('/src/utils/inspectionData.ts');
const { buildRoomsForPropertyType } = await import('/src/data/propertyTemplates.ts');
// Local-only deterministic API doubles: never create users, orders, or inspections remotely.
client.api.fetch = async (path, opts = {}) => {
  if (path.includes('/photos')) return new Response(JSON.stringify({ photos: [] }));
  if (path.includes('/sync/inspections')) return new Response(JSON.stringify({ data: [] }));
  return new Response(JSON.stringify({ success: true, data: { paymentData: '{"paid":true}' } }));
};
useAuthStore.getState().setUser({ id: 'qa-local', email: 'qa@example.test', name: 'QA Inspector' });
const store = useInspectionStore.getState();
store.createInspection('apartment', { bedrooms: 1, bathrooms: 1 });
store.updateProperty({ buildingName: 'Phase 1 Test Property', area: 'Dubai Marina', makaniNumber: '1234567890' });
const item = (id, name, condition, comments = '', photos = []) => ({ id, name, category: 'custom', condition, comments, photos, checked: !!condition });
store.setRooms([{ id: 'living', name: 'Living room', type: 'living', icon: '', overallComments: '', overallCondition: null, items: [item('paint1', 'Paint Condition', 'good', 'First note'), item('paint2', 'Paint Condition', 'fair', 'Second note'), item('light', 'Light Fixtures', 'poor', 'Cracked lens'), item('kept', 'Kept Not Rated', null), item('delete-me', 'Deleted checklist item', 'good')] }, { id: 'delete-room', name: 'Deleted room', type: 'other', icon: '', overallComments: '', overallCondition: null, items: [item('x', 'Ghost item', 'good')] }]);
store.removeItem(0, 'delete-me'); store.removeRoom(1);
const current = useInspectionStore.getState().currentInspection;
const sum = inspectionSummary(current);
if (sum.rooms !== 1 || sum.total !== 3 || sum.rated !== 2 || sum.fair !== 1 || sum.issues !== 1 || sum.findings.length !== 2) throw new Error('Summary/deletion regression');
if (!current.rooms[0].items[0].comments.includes('Second note')) throw new Error('Duplicate lost notes');
for (const type of ['apartment','townhouse','villa','office']) for (const room of buildRoomsForPropertyType(type,2,2)) {
  if (new Set(room.items.map(i => i.name)).size !== room.items.length) throw new Error('Duplicate defaults');
  if (room.items.some(i => /carpet|wallpaper|ceiling fan/i.test(i.name))) throw new Error('Irrelevant defaults');
}
store.setCurrentInspection({ ...current, payment: { paid: true, amount: 199, currency: 'AED', method: 'card' } });
console.log(JSON.stringify({ phase1: 'PASS', summary: sum, localPhotoBytes: localStorage.getItem('propinspect-storage').includes('data:image') }));
history.pushState({}, '', `/report/${current.id}`); window.dispatchEvent(new PopStateEvent('popstate'));

return { result: 'PASS', summary: { rooms: sum.rooms, total: sum.total, rated: sum.rated, good: sum.good, fair: sum.fair, issues: sum.issues } };
})()
