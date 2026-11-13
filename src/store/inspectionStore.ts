import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { allPhotos, mapPhotos, metadataOnly, normalizeInspection, itemKey } from '../utils/inspectionData';
import { configureBackup, queuePhoto, saveInspection, restorePhotos, retryPhotoBackups, reportSaveError, discardBackup, fromBackend } from '../utils/draftBackup';
import { client } from '../api/client';
import { useAuthStore } from './authStore';
import {
  Inspection,
  PropertyType,
  PropertyDetails,
  PartyDetails,
  TenancyDetails,
  Room,
  InspectionItem,
  PropertyItem,
  Photo,
  ConditionRating,
  Signature,
  PaymentInfo,
} from '../types';
import { buildRoomsForPropertyType, buildRoomsForOffice, dedupeRoomItems } from '../data/propertyTemplates';
import { getLocation, getIPAddress } from '../utils/helpers';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// All writes use the same per-inspection serial chain (including payments' pre-save).
const retrySync = saveInspection;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleAutoSync(snapshot?: Inspection) {
  const inspection = snapshot || useInspectionStore.getState().currentInspection;
  if (!inspection) return;
  const previous = syncTimers.get(inspection.id);
  if (previous) clearTimeout(previous);
  syncTimers.set(inspection.id, setTimeout(() => {
    syncTimers.delete(inspection.id);
    const state = useInspectionStore.getState();
    const latest = state.getInspection(inspection.id);
    if (latest && !state.deletedIds.includes(inspection.id)) void saveInspection(latest);
  }, 350));
}

interface InspectionState {
  inspections: Inspection[];
  currentInspection: Inspection | null;
  currentStep: number;
  currentRoomIndex: number;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  deletedIds: string[]; // Track locally-deleted inspection IDs to prevent resurrection from backend sync

  // Actions
  createInspection: (propertyType: PropertyType, counts: { bedrooms: number; bathrooms: number }) => void;
  updateProperty: (property: Partial<PropertyDetails>) => void;
  updateTenant: (tenant: Partial<PartyDetails>) => void;
  updateLandlord: (landlord: Partial<PartyDetails>) => void;
  updateAgent: (agent: Partial<PartyDetails>) => void;
  updateTenancy: (tenancy: Partial<TenancyDetails>) => void;
  updateGeneralNotes: (notes: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentRoomIndex: (index: number) => void;
  updatePropertyItem: (itemId: string, value: string, comments: string) => void;
  addPhotoToPropertyItem: (itemId: string, photo: Photo) => void;
  removePhotoFromPropertyItem: (itemId: string, photoId: string) => void;

  updateOptionalDetails: (details: Pick<Inspection, 'utilityMeters' | 'moveInReference'>) => void;
  setMeterPhoto: (meter: string, photo?: Photo) => void;

  // Room actions
  updateItemCondition: (roomIndex: number, itemId: string, condition: ConditionRating) => void;
  updateItemComments: (roomIndex: number, itemId: string, comments: string) => void;
  toggleItemChecked: (roomIndex: number, itemId: string) => void;
  addPhotoToItem: (roomIndex: number, itemId: string, photo: Photo) => void;
  removePhotoFromItem: (roomIndex: number, itemId: string, photoId: string) => void;
  updateRoomComments: (roomIndex: number, comments: string) => void;
  addOverallPhoto: (photo: Photo) => void;
  removeOverallPhoto: (photoId: string) => void;

  // Room/Item management
  addRoom: (room: Room) => void;
  removeRoom: (roomIndex: number) => void;
  updateRoomName: (roomIndex: number, name: string) => void;
  addItem: (roomIndex: number, item: InspectionItem) => void;
  removeItem: (roomIndex: number, itemId: string) => void;
  setRooms: (rooms: Room[]) => void;

  // Signatures
  addSignature: (signature: Signature) => void;
  removeSignature: (role: 'tenant' | 'landlord' | 'inspector') => void;

  // Payment
  recordPayment: (inspectionId: string, payment: PaymentInfo) => void;

  // Completion
  completeInspection: () => void;
  saveDraft: () => void;

  // Sync
  syncFromBackend: () => Promise<void>;
  pushToBackend: () => Promise<void>;
  // Synchronously guarantees the current inspection row exists in the backend
  // DB and resolves to `true` only when the sync is confirmed. Used by the iOS
  // in-app-purchase flow to avoid the webhook-before-row race condition.
  syncCurrentInspection: () => Promise<boolean>;
  getSyncStatus: () => { lastSyncTime: string | null; status: string };

  // Management
  deleteInspection: (id: string) => void;
  getInspection: (id: string) => Inspection | undefined;
  setCurrentInspection: (inspection: Inspection | null) => void;
  resetCurrentInspection: () => void;
}

function assignIds(rooms: Omit<Room, 'id'>[]): Room[] {
  return rooms.map(room => ({
    ...room,
    id: generateId(),
    // Defensive de-dup: guarantees a freshly-created room can never start
    // with repeated checklist items, regardless of how its item list was
    // assembled upstream.
    items: dedupeRoomItems(room.items).map(item => ({
      ...item,
      id: item.id === 'general' ? 'general' : generateId(),
    })),
  }));
}

// Small metadata only. Storage failures are visible; never throw out of a form change.
const metadataStorage: StateStorage = {
  getItem: (name) => { try { return localStorage.getItem(name); } catch { reportSaveError('Local draft could not be read. Connect to restore your cloud draft.'); return null; } },
  setItem: (name, value) => { try { localStorage.setItem(name, value); } catch { reportSaveError('Local draft save failed: device storage is full or unavailable. Keep the app open until cloud backup completes.'); } },
  removeItem: (name) => { try { localStorage.removeItem(name); } catch { reportSaveError('Could not remove the local draft.'); } },
};

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set, get) => ({
      inspections: [],
      currentInspection: null,
      currentStep: 0,
      currentRoomIndex: 0,
      lastSyncTime: null,
      syncStatus: 'idle' as const,
      deletedIds: [] as string[],

      createInspection: (propertyType, counts) => {
        console.log('[Store] createInspection called', { propertyType, counts });
        const rooms = assignIds(
          propertyType === 'office'
            ? buildRoomsForOffice(counts.bedrooms, counts.bathrooms)
            : buildRoomsForPropertyType(propertyType, counts.bedrooms, counts.bathrooms)
        );

        const now = new Date().toISOString();
        const inspection: Inspection = {
          id: generateId(),
          propertyType,
          status: 'in_progress',
          property: {
            type: propertyType,
            makaniNumber: '',
            area: '',
            city: 'Dubai',
            buildingName: '',
            unitNumber: '',
            totalAreaSqft: undefined,
            bedrooms: counts.bedrooms,
            bathrooms: counts.bathrooms,
            furnished: false,
            specialFeatures: [],
          },
          tenant: { name: '', phone: '', email: '' },
          landlord: { name: '', phone: '', email: '' },
          agent: undefined,
          tenancy: {
            leaseStartDate: '',
            leaseEndDate: '',
            contractNumber: '',
          },
          rooms,
          propertyItems: [
            { id: 'keys', name: 'Keys', value: '', comments: '', photos: [] },
            { id: 'access_cards', name: 'Access Cards', value: '', comments: '', photos: [] },
          ],
          generalNotes: '',
          overallPhotos: [],
          signatures: [],
          createdAt: now,
          updatedAt: now,
          meta: {
            inspectorId: useAuthStore.getState().user?.id || 'unknown',
            inspectorName: localStorage.getItem('inspector_name') || 'Inspector',
            inspectorEmail: useAuthStore.getState().user?.email || '',
            deviceInfo: navigator.userAgent,
            appVersion: '1.0.0',
          },
          reportGenerated: false,
        };

        set({
          currentInspection: inspection,
          inspections: [...get().inspections.filter(i => i.id !== inspection.id), inspection],
          currentStep: 0,
          currentRoomIndex: 0,
        });

        // Fetch geolocation and IP address asynchronously and update the inspection
        (async () => {
          const [loc, ip] = await Promise.all([getLocation(), getIPAddress()]);
          const { currentInspection } = get();
          if (currentInspection && currentInspection.id === inspection.id) {
            set({
              currentInspection: {
                ...currentInspection,
                meta: {
                  ...currentInspection.meta,
                  ...(loc ? { location: loc } : {}),
                  ...(ip ? { ipAddress: ip } : {}),
                },
              },
            });
          }
        })();
      },

      updateProperty: (property) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            property: { ...currentInspection.property, ...property },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateTenant: (tenant) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            tenant: { ...currentInspection.tenant, ...tenant },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateLandlord: (landlord) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            landlord: { ...currentInspection.landlord, ...landlord },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateAgent: (agent) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            agent: { ...(currentInspection.agent || { name: '', phone: '', email: '' }), ...agent },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateTenancy: (tenancy) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            tenancy: { ...currentInspection.tenancy, ...tenancy },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateGeneralNotes: (notes) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            generalNotes: notes,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateOptionalDetails: (details) => {
        const current = get().currentInspection;
        if (!current) return;
        set({ currentInspection: { ...current, ...details, updatedAt: new Date().toISOString() } });
        scheduleAutoSync();
      },
      setMeterPhoto: (meter, photo) => {
        const current = get().currentInspection;
        if (!current) return;
        const meters = { ...current.utilityMeters, [meter]: { reading: current.utilityMeters?.[meter]?.reading || '', photo: photo ? { ...photo, backupStatus: 'pending' as const } : undefined } };
        set({ currentInspection: { ...current, utilityMeters: meters, updatedAt: new Date().toISOString() } });
        if (photo) queuePhoto(current.id, photo, 'meters', meter);
        scheduleAutoSync();
      },

      updatePropertyItem: (itemId, value, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, value, comments } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      addPhotoToPropertyItem: (itemId, photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, photos: [...item.photos, { ...photo, backupStatus: 'pending' as const }] } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();

        queuePhoto(currentInspection.id, photo, 'property', itemId);
      },

      removePhotoFromPropertyItem: (itemId, photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, photos: item.photos.filter(p => p.id !== photoId) } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      setCurrentStep: (step) => set(state => ({ currentStep: step, currentInspection: state.currentInspection ? { ...state.currentInspection, position: { step, roomIndex: state.currentRoomIndex } } : null })),
      setCurrentRoomIndex: (index) => set(state => ({ currentRoomIndex: index, currentInspection: state.currentInspection ? { ...state.currentInspection, position: { step: state.currentStep, roomIndex: index } } : null })),

      updateItemCondition: (roomIndex, itemId, condition) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, condition, checked: true } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      updateItemComments: (roomIndex, itemId, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, comments } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      toggleItemChecked: (roomIndex, itemId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      addPhotoToItem: (roomIndex, itemId, photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, photos: [...item.photos, { ...photo, backupStatus: 'pending' as const }], checked: true } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();

        queuePhoto(currentInspection.id, photo, currentInspection.rooms[roomIndex].id, itemId);
      },

      removePhotoFromItem: (roomIndex, itemId, photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, photos: item.photos.filter(p => p.id !== photoId) } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      updateRoomComments: (roomIndex, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return { ...r, overallComments: comments };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      addOverallPhoto: (photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            overallPhotos: [...currentInspection.overallPhotos, { ...photo, backupStatus: 'pending' as const }],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();

        queuePhoto(currentInspection.id, photo, 'overall', 'cover');
      },

      removeOverallPhoto: (photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            overallPhotos: currentInspection.overallPhotos.filter(p => p.id !== photoId),
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      // Room/Item management
      addRoom: (room) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const newRoom = {
          ...room,
          id: generateId(),
          items: dedupeRoomItems(room.items).map(item => ({ ...item, id: item.id === 'general' ? 'general' : generateId() })),
        };
        set({
          currentInspection: {
            ...currentInspection,
            rooms: [...currentInspection.rooms, newRoom],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removeRoom: (roomIndex) => {
        const { currentInspection, currentRoomIndex } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.filter((_, i) => i !== roomIndex);
        const newCurrentIndex = currentRoomIndex >= rooms.length
          ? Math.max(0, rooms.length - 1)
          : currentRoomIndex >= roomIndex
          ? Math.max(0, currentRoomIndex - 1)
          : currentRoomIndex;
        set({
          currentInspection: { ...currentInspection, deletedRoomIds: [...(currentInspection.deletedRoomIds || []), currentInspection.rooms[roomIndex].id], rooms: [...rooms], updatedAt: new Date().toISOString() },
          currentRoomIndex: newCurrentIndex,
        });
      },

      updateRoomName: (roomIndex, name) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) =>
          i === roomIndex ? { ...r, name } : r
        );
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
      },

      addItem: (roomIndex, item) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          // Guard against accidental double-submission (e.g. a fast double
          // tap on mobile firing the add handler twice): don't insert a
          // second item with the exact same name into the same room.
          const nameKey = (item.name || '').trim().toLowerCase();
          const alreadyExists = nameKey && r.items.some(existing => (existing.name || '').trim().toLowerCase() === nameKey);
          if (alreadyExists) return { ...r, items: dedupeRoomItems([...r.items, item]) };
          return { ...r, items: [...r.items, { ...item, id: generateId() }] };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
      },

      removeItem: (roomIndex, itemId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          const removed = r.items.find(item => item.id === itemId);
          return { ...r, items: r.items.filter(item => item.id !== itemId && (!removed || itemKey(item.name) !== itemKey(removed.name))) };
        });
        set({
          currentInspection: { ...currentInspection, deletedItemIds: [...(currentInspection.deletedItemIds || []), ...currentInspection.rooms[roomIndex].items.filter(i => i.id === itemId || itemKey(i.name) === itemKey(currentInspection.rooms[roomIndex].items.find(i => i.id === itemId)?.name || '')).flatMap(i => [i.id, ...(i.mergedIds || [])]).map(id => `${currentInspection.rooms[roomIndex].id}:${id}`)], rooms, updatedAt: new Date().toISOString() },
        });
      },

      setRooms: (newRooms) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        // Deep clone rooms to prevent any reference mutation, and de-dup each
        // room's items so a caller can never introduce duplicate checklist
        // entries by re-passing an already-populated rooms array.
        const clonedRooms = JSON.parse(JSON.stringify(newRooms)).map((r: any) => ({
          ...r,
          items: dedupeRoomItems(r.items || []),
        }));
        set({
          currentInspection: { ...currentInspection, rooms: clonedRooms, updatedAt: new Date().toISOString() },
        });
      },

      // Signatures
      addSignature: (signature) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const existing = currentInspection.signatures.filter(s => s.role !== signature.role);
        set({
          currentInspection: {
            ...currentInspection,
            signatures: [...existing, signature],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removeSignature: (role) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            signatures: currentInspection.signatures.filter(s => s.role !== role),
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      recordPayment: (inspectionId, payment) => {
        const { inspections, currentInspection } = get();
        const updatedPayment = {
          ...payment,
          paidAt: new Date().toISOString(),
          transactionId: `txn_${generateId()}`,
        };

        const newInspections = inspections.map(i =>
          i.id === inspectionId ? { ...i, payment: updatedPayment, updatedAt: new Date().toISOString() } : i
        );

        const newCurrent = currentInspection?.id === inspectionId
          ? { ...currentInspection, payment: updatedPayment, updatedAt: new Date().toISOString() }
          : currentInspection;

        set({
          inspections: newInspections,
          currentInspection: newCurrent,
        });
      },

      completeInspection: () => {
        const inspection = get().currentInspection;
        if (!inspection) return;
        const ready = { ...inspection, completedAt: inspection.completedAt || new Date().toISOString() };
        set({ currentInspection: ready });
        void saveInspection(ready);
      },

      saveDraft: () => {
        const { currentInspection, inspections } = get();
        if (!currentInspection) return;
        const draft = {
          ...currentInspection,
          status: 'draft' as const,
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = inspections.findIndex(i => i.id === draft.id);
        const newInspections = [...inspections];
        if (existingIndex >= 0) {
          newInspections[existingIndex] = draft;
        } else {
          newInspections.push(draft);
        }

        set({ inspections: newInspections, currentInspection: draft });

        // Sync to backend with retry
        retrySync(draft).then(success => {
          if (!success) {
            console.error('[Store] Failed to sync draft inspection after retries');
          }
        });
      },

      // ==================== SYNC METHODS ====================

      syncFromBackend: async () => {
        set({ syncStatus: 'syncing' });
        try {
          const response = await client.api.fetch('/api/sync/inspections');
          if (!response.ok) throw new Error('Cloud drafts could not be loaded.');
          const result = await response.json();
          const state = get(); // Re-read after the network wait; never overwrite edits made meanwhile.
          const merged = new Map(state.inspections.map(i => [i.id, i]));
          if (state.currentInspection) merged.set(state.currentInspection.id, state.currentInspection);
          for (const row of result.data || []) {
            if (state.deletedIds.includes(row.id)) continue;
            const remote = fromBackend(row);
            const local = merged.get(row.id);
            if (!local) merged.set(row.id, remote);
            else if (local.status !== 'completed') {
              // This device's in-progress checklist is authoritative, including removals.
              const photos = new Map(allPhotos(remote).map(p => [p.id, p]));
              merged.set(row.id, mapPhotos({ ...local, payment: remote.payment }, p => ({ ...photos.get(p.id), ...p, cloudPath: p.cloudPath || photos.get(p.id)?.cloudPath })));
            } else merged.set(row.id, { ...local, payment: remote.payment });
          }
          const syncedInspections = [...merged.values()].map(normalizeInspection);
          const syncedCurrent = state.currentInspection
            ? syncedInspections.find(i => i.id === state.currentInspection!.id) || state.currentInspection
            : null;
          set({
            inspections: syncedInspections,
            // Keep the open draft's device-local edits, but immediately adopt
            // server-authoritative fields (especially payment) from the merged row.
            // Previously only `inspections` was refreshed, leaving the wizard's
            // `currentInspection` permanently paywalled until it was reopened.
            currentInspection: syncedCurrent,
            syncStatus: 'synced',
            lastSyncTime: new Date().toISOString(),
          });
          if (syncedCurrent) void restorePhotos(syncedCurrent.id);
          for (const id of state.deletedIds) void discardBackup(id).catch(e => reportSaveError(e.message));
        } catch (e) { set({ syncStatus: 'error' }); reportSaveError(e instanceof Error ? e.message : 'Cloud sync failed.'); }
      },

      pushToBackend: async () => {
        set({ syncStatus: 'syncing' });
        const results = await Promise.all(get().inspections.map(saveInspection));
        set({ syncStatus: results.every(Boolean) ? 'synced' : 'error', lastSyncTime: new Date().toISOString() });
      },

      getSyncStatus: () => {
        const { lastSyncTime, syncStatus } = get();
        return { lastSyncTime, status: syncStatus };
      },

      // Guarantees the current inspection exists in the backend DB before a
      // critical action (iOS in-app purchase). Ensures the record is in the
      // local `inspections` array, then pushes it to the backend and confirms
      // success. Returns `true` ONLY when the backend accepted the write, so
      // the RevenueCat webhook (which resolves the report by inspection.id)
      // will always find a matching row — closing the webhook-before-row race.
      syncCurrentInspection: async () => {
        const { currentInspection, inspections } = get();
        if (!currentInspection?.id) {
          console.warn('[Store] syncCurrentInspection: no current inspection');
          return false;
        }

        // Make sure the current inspection is persisted in the local array so
        // subsequent syncs/reads see it (it may only live in currentInspection).
        const existingIndex = inspections.findIndex(i => i.id === currentInspection.id);
        const newInspections = [...inspections];
        if (existingIndex >= 0) {
          newInspections[existingIndex] = currentInspection;
        } else {
          newInspections.push(currentInspection);
        }
        set({ inspections: newInspections, syncStatus: 'syncing' });

        // Push just this inspection with retry and wait for a confirmed result.
        const ok = await retrySync(currentInspection);
        set({
          syncStatus: ok ? 'synced' : 'error',
          ...(ok ? { lastSyncTime: new Date().toISOString() } : {}),
        });
        console.log('[Store] syncCurrentInspection result:', ok, currentInspection.id);
        return ok;
      },

      deleteInspection: (id) => {
        const state = get();
        set({ inspections: state.inspections.filter(i => i.id !== id), currentInspection: state.currentInspection?.id === id ? null : state.currentInspection, deletedIds: [...state.deletedIds, id] });
        void discardBackup(id).catch(e => reportSaveError(e.message));
      },

      getInspection: (id) => {
        const { inspections, currentInspection } = get();
        if (currentInspection?.id === id) return currentInspection;
        return inspections.find(i => i.id === id);
      },

      setCurrentInspection: (inspection) => {
        set({ currentInspection: inspection ? normalizeInspection(inspection) : null,
          currentStep: inspection?.position?.step || 0, currentRoomIndex: inspection?.position?.roomIndex || 0 });
        // A completed pre-flight holds stable data URLs. Do not overwrite them
        // with another short-lived signed URL while the PDF is rendering.
        if (inspection && allPhotos(inspection).some(photo => !photo.url && photo.cloudPath)) void restorePhotos(inspection.id);
      },

      resetCurrentInspection: () => set({ currentInspection: null, currentStep: 0, currentRoomIndex: 0 }),
    }),
    {
      name: 'propinspect-storage',
      storage: createJSONStorage(() => metadataStorage),
      partialize: (state) => ({
        inspections: state.inspections.filter(i => i.id !== state.currentInspection?.id).map(i => metadataOnly(i)!),
        currentInspection: metadataOnly(state.currentInspection),
        currentStep: state.currentStep,
        currentRoomIndex: state.currentRoomIndex,
        lastSyncTime: state.lastSyncTime,
        deletedIds: state.deletedIds,
      }),
      merge: (persisted: any, current) => {
        const restored = { ...current, ...(persisted || {}) };
        restored.currentInspection = restored.currentInspection ? normalizeInspection(restored.currentInspection) : null;
        restored.inspections = (restored.inspections || []).map(normalizeInspection);
        if (restored.currentInspection) restored.inspections = [...restored.inspections.filter((i: Inspection) => i.id !== restored.currentInspection.id), restored.currentInspection];
        return restored;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          reportSaveError('Draft could not be restored locally. Reconnect to load the cloud copy.');
        }
      },
    }
  )
);


configureBackup(
  id => useInspectionStore.getState().getInspection(id),
  (id, transform) => useInspectionStore.setState(state => ({
    inspections: state.inspections.map(i => i.id === id ? transform(i) : i),
    currentInspection: state.currentInspection?.id === id ? transform(state.currentInspection) : state.currentInspection,
  }))
);
// Every mutation is immediately persisted locally and scheduled for cloud backup,
// including item/room removals, names, notes, signatures and current position.
useInspectionStore.subscribe((state, previous) => {
  if (previous.currentInspection && previous.currentInspection.id !== state.currentInspection?.id && !state.deletedIds.includes(previous.currentInspection.id)) {
    void saveInspection(previous.currentInspection);
  }
  if (state.currentInspection && state.currentInspection !== previous.currentInspection) {
    const inspection = state.currentInspection;
    useInspectionStore.setState({ inspections: [...state.inspections.filter(i => i.id !== inspection.id), inspection] });
    scheduleAutoSync();
  }
});
if (typeof window !== 'undefined') {
  const retry = () => {
    void retryPhotoBackups();
    const state = useInspectionStore.getState();
    if (state.currentInspection) { void saveInspection(state.currentInspection); void restorePhotos(state.currentInspection.id); }
    for (const id of state.deletedIds) void discardBackup(id).catch(e => reportSaveError(e.message));
  };
  window.addEventListener('online', retry);
  window.addEventListener('beforeunload', event => {
    const current = useInspectionStore.getState().currentInspection;
    if (current && allPhotos(current).some(p => p.backupStatus !== 'backed_up')) { event.preventDefault(); event.returnValue = ''; }
  });
  setInterval(() => { if (navigator.onLine) { void retryPhotoBackups(); const i = useInspectionStore.getState().currentInspection; if (i && i.status !== 'completed') void saveInspection(i); } }, 30000);
}
