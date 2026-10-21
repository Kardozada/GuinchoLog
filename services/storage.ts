import { DailyLog, User, FuelRecord, MaintenanceRecord } from '../types';
import { db, authReady, storage } from './firebase';
import { collection, doc, setDoc, getDoc, getDocFromServer, getDocs, getDocsFromCache, getDocsFromServer, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

// Envia uma imagem (data URL base64) para o Storage e devolve a URL de download.
// Guardamos essa URL curta no documento em vez do base64 gigante — deixa os
// documentos leves e evita estouro de memória ao carregar listas.
export const uploadImageDataUrl = async (path: string, dataUrl: string): Promise<string> => {
  await authReady;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
};

const USER_KEY = 'guincholog_user';
const LOGS_COLLECTION = 'logs';
const FUELS_COLLECTION = 'abastecimentos';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Helper to handle offline/quota reads safely with smart caching
async function getDocsSmart(q: any, cacheKey: string, cooldownMs = 5 * 60 * 1000) {
  const syncKey = `sync_time_${cacheKey}`;
  const lastSync = localStorage.getItem(syncKey);
  const now = Date.now();

  if (lastSync && (now - parseInt(lastSync, 10)) < cooldownMs) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return cached;
      }
    } catch (e) {
      console.warn("Smart cache read failed or empty, falling back to server.", e);
    }
  }

  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout")), 15000)
  );
  
  try {
    // Espera o login anônimo antes de ir ao servidor (regras exigem auth).
    await authReady;
    const snapshot = await Promise.race([getDocs(q), timeoutPromise]) as any;
    localStorage.setItem(syncKey, now.toString());
    return snapshot;
  } catch (error) {
    console.warn("Read from server failed, falling back to cache.", error);
    try {
      return await getDocsFromCache(q);
    } catch (cacheError) {
      console.warn("Cache read also failed.", cacheError);
      throw error;
    }
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  
  if (errInfo.error.includes("Quota limit exceeded")) {
    console.warn("Quota exceeded limit. Falling back or ignoring.");
  } else {
    console.warn('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  if (operationType === OperationType.GET) {
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export const saveLog = async (log: DailyLog): Promise<void> => {
  const path = `${LOGS_COLLECTION}/${log.id}`;
  try {
    const docRef = doc(db, LOGS_COLLECTION, log.id);
    const cleanLog = JSON.parse(JSON.stringify(log));
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: Verifique sua conexão com a internet.")), 15000)
    );
    
    await Promise.race([setDoc(docRef, cleanLog), timeoutPromise]);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

// Lê um registro direto do servidor (não do cache), para decidir com o estado
// mais recente — ex.: saber se o dia foi conferido enquanto o motorista editava.
export const getLogById = async (logId: string): Promise<DailyLog | null> => {
  try {
    await authReady;
    const ref = doc(db, LOGS_COLLECTION, logId);
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref); // sem rede: cai no cache local
    }
    return snap.exists() ? (snap.data() as DailyLog) : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `${LOGS_COLLECTION}/${logId}`);
    return null;
  }
};

// Dia conferido = carimbado pelo Hudson ou marcado pelo André. Aceita os
// formatos antigos em texto ("true"/"TRUE") vindos da planilha.
export const isLogConferred = (log: Partial<DailyLog> | null | undefined): boolean => {
  if (!log) return false;
  const t = (v: any) => v === true || v === 'true' || v === 'TRUE';
  return t(log.checkedHudson) || t(log.checkedAndre) || t((log as any).checked);
};

// Campos que pertencem ao administrativo (conferência + auditoria). Nenhuma
// gravação feita a partir de uma cópia da tela pode sobrescrevê-los.
export const CONFERENCE_KEYS = [
  'checkedHudson', 'checkedAndre', 'checked',
  'checkedHudsonBy', 'checkedHudsonAt', 'checkedAndreBy', 'checkedAndreAt',
] as const;

// Copia para `log` o estado de conferência atual do servidor.
export const copyConference = (from: Partial<DailyLog> | null, to: DailyLog): DailyLog => {
  if (!from) return to;
  for (const k of CONFERENCE_KEYS) {
    if ((from as any)[k] !== undefined) (to as any)[k] = (from as any)[k];
  }
  return to;
};

// Marca/desmarca a conferência gravando SÓ o campo daquela pessoa (merge), e
// registra quem fez e quando. Antes o painel regravava o registro inteiro a
// partir da cópia da tela — se estivesse desatualizada, o check do André
// apagava o carimbo do Hudson (e vice-versa).
export const setLogCheck = async (
  logId: string,
  field: 'checkedHudson' | 'checkedAndre',
  value: boolean,
  by: string
): Promise<void> => {
  const path = `${LOGS_COLLECTION}/${logId}`;
  try {
    await authReady;
    const patch: Record<string, unknown> = {
      [field]: value,
      [`${field}By`]: by,
      [`${field}At`]: new Date().toISOString(),
    };
    if (field === 'checkedAndre') patch.checked = value; // campo legado
    await setDoc(doc(db, LOGS_COLLECTION, logId), patch, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

export const updateLog = async (log: DailyLog): Promise<void> => {
  await saveLog(log);
};

// --- Lixeira ---------------------------------------------------------------
// Excluir não apaga de vez: o documento vai para a coleção 'lixeira' (com quem
// excluiu e quando) e pode ser restaurado por 30 dias.
const TRASH_COLLECTION = 'lixeira';
export const TRASH_DAYS = 30;
export type TrashableCollection = 'logs' | 'abastecimentos';
// 'servico' e 'despesa' = item removido de dentro de um relatório (pela edição)
export type TrashKind = TrashableCollection | 'servico' | 'despesa';
export interface TrashItem {
  id: string;                    // id na lixeira: `${collection}__${originalId}`
  collection: TrashKind;
  originalId: string;
  data: any;                     // documento/item original, intacto
  deletedAt: string;
  deletedBy: string;
  logId?: string;                // para serviço/despesa: relatório de onde saiu
  context?: { driverName?: string; date?: string; vehicleId?: string };
}
export const trashIdFor = (col: TrashableCollection, id: string) => `${col}__${id}`;

const moveToTrash = async (col: TrashableCollection, id: string, by?: string): Promise<void> => {
  await authReady;
  const ref = doc(db, col, id);
  let snap;
  try { snap = await getDocFromServer(ref); } catch { snap = await getDoc(ref); }
  if (!snap.exists()) return;
  const batch = writeBatch(db); // copia e apaga juntos: ou acontecem as duas coisas, ou nenhuma
  batch.set(doc(db, TRASH_COLLECTION, trashIdFor(col, id)), {
    collection: col, originalId: id, data: snap.data(),
    deletedAt: new Date().toISOString(), deletedBy: by || 'Desconhecido',
  });
  batch.delete(ref);
  await batch.commit();
};

// Totais do relatório, com as mesmas regras do painel.
const recomputeTotals = (services: any[], expenses: any[]) => {
  const n = (v: any) => Number(v) || 0;
  const totalInvoiced = services.reduce((t, s) => t + n(s.value), 0);
  const totalExpenses = expenses.reduce((t, e) => t + n(e.value), 0);
  const totalLiquidTerm = services.filter(s => s.paymentMethod === 'A PRAZO').reduce((t, s) => t + n(s.value), 0);
  const totalLiquidCash = services.filter(s => s.paymentMethod === 'DINHEIRO' || s.paymentMethod === 'CASH')
    .reduce((t, s) => t + n(s.value), 0) - totalExpenses;
  return { totalInvoiced, totalExpenses, totalLiquidTerm, totalLiquidCash };
};

// Serviços/despesas removidos de um relatório na edição do painel vão para a
// lixeira, para poderem voltar ao relatório depois.
export const trashLogItems = async (
  log: DailyLog, removedServices: any[], removedExpenses: any[], by?: string
): Promise<void> => {
  if (removedServices.length === 0 && removedExpenses.length === 0) return;
  await authReady;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const context = { driverName: log.driverName, date: log.date, vehicleId: log.vehicleId };
  const put = (kind: 'servico' | 'despesa', item: any) =>
    batch.set(doc(db, TRASH_COLLECTION, `${kind}__${log.id}__${item.id}`), JSON.parse(JSON.stringify({
      collection: kind, originalId: item.id, logId: log.id, data: item, context, deletedAt: now, deletedBy: by || 'Desconhecido',
    })));
  removedServices.forEach(s => put('servico', s));
  removedExpenses.forEach(e => put('despesa', e));
  await batch.commit();
};

export const restoreFromTrash = async (trashId: string): Promise<void> => {
  await authReady;
  const tRef = doc(db, TRASH_COLLECTION, trashId);
  let snap;
  try { snap = await getDocFromServer(tRef); } catch { snap = await getDoc(tRef); }
  if (!snap.exists()) throw new Error('Item não está mais na lixeira.');
  const item = snap.data() as TrashItem;

  if (item.collection === 'servico' || item.collection === 'despesa') {
    const lRef = doc(db, LOGS_COLLECTION, item.logId!);
    let lSnap;
    try { lSnap = await getDocFromServer(lRef); } catch { lSnap = await getDoc(lRef); }
    if (!lSnap.exists()) throw new Error('O relatório deste item não existe mais. Restaure o relatório primeiro.');
    const log = lSnap.data() as DailyLog;
    const services = Array.isArray(log.services) ? [...log.services] : [];
    const expenses = Array.isArray(log.expenses) ? [...log.expenses] : [];
    const list: any[] = item.collection === 'servico' ? services : expenses;
    if (!list.some(x => x.id === item.originalId)) list.push(item.data);
    const label = item.collection === 'servico'
      ? `serviço ${item.data?.clientName || ''} (${item.data?.paymentMethod || ''} R$ ${Number(item.data?.value || 0).toFixed(2)})`
      : `despesa ${item.data?.description || ''} (R$ ${Number(item.data?.value || 0).toFixed(2)})`;
    const editHistory = [...(log.editHistory || []), {
      editedBy: 'Lixeira', editedAt: new Date().toISOString(), changes: `Restaurado da lixeira: ${label}.`,
    }];
    const batch = writeBatch(db);
    batch.set(lRef, { services, expenses, ...recomputeTotals(services, expenses), editHistory }, { merge: true });
    batch.delete(tRef);
    await batch.commit();
    localStorage.removeItem('sync_time_logs_all');
    return;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, item.collection, item.originalId), item.data);
  batch.delete(tRef);
  await batch.commit();
  localStorage.removeItem(item.collection === 'logs' ? 'sync_time_logs_all' : 'sync_time_fuels_all');
};

// Lista a lixeira (sempre do servidor) e descarta o que passou de 30 dias.
export const fetchTrash = async (): Promise<TrashItem[]> => {
  await authReady;
  const snap = await getDocsFromServer(query(collection(db, TRASH_COLLECTION)));
  const limit = Date.now() - TRASH_DAYS * 86400000;
  const items: TrashItem[] = [];
  const expired: string[] = [];
  snap.forEach((d) => {
    const it = { id: d.id, ...(d.data() as Omit<TrashItem, 'id'>) };
    if (new Date(it.deletedAt).getTime() < limit) expired.push(d.id); else items.push(it);
  });
  await Promise.all(expired.map(id => deleteDoc(doc(db, TRASH_COLLECTION, id)).catch(() => {})));
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
};

export const deleteLog = async (logId: string, by?: string): Promise<void> => {
  const path = `${LOGS_COLLECTION}/${logId}`;
  try {
    await moveToTrash(LOGS_COLLECTION as TrashableCollection, logId, by);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
};

export const fetchLogsFromFirestore = async (): Promise<DailyLog[]> => {
  try {
    const q = query(collection(db, LOGS_COLLECTION));
    
    const querySnapshot = await getDocsSmart(q, 'logs_all');
    const logs: DailyLog[] = [];
    querySnapshot.forEach((doc) => {
      logs.push(doc.data() as DailyLog);
    });
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, LOGS_COLLECTION);
    return []; // fallback if not thrown
  }
};

export const getAllLogs = async (): Promise<DailyLog[]> => {
  return await fetchLogsFromFirestore();
};

export const getLogsByUser = async (userId: string, driverName?: string): Promise<DailyLog[]> => {
  try {
    const q = query(collection(db, LOGS_COLLECTION), where("userId", "==", userId));
    
    const querySnapshot = await getDocsSmart(q, `logs_user_${userId}`);
    const logs: DailyLog[] = [];
    querySnapshot.forEach((doc) => {
      logs.push(doc.data() as DailyLog);
    });
    
    // Also include logs where driverName matches, as fallback for older records without userId
    let finalLogs = logs;
    if (driverName && logs.length === 0) {
       // Only if we didn't find any by userId, try fetching all and filtering (legacy fallback)
       // But to avoid quota issues, let's just skip it if it's too much, or do a separate query.
       // Actually, we can't do a case-insensitive query in Firestore, so we'll just return what we got by userId.
    }

    return finalLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, LOGS_COLLECTION);
    return [];
  }
};

export const getCurrentUser = (): User | null => {
  const str = localStorage.getItem(USER_KEY);
  return str ? JSON.parse(str) : null;
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

export const saveFuelRecord = async (record: FuelRecord): Promise<void> => {
  const path = `${FUELS_COLLECTION}/${record.id}`;
  try {
    const docRef = doc(db, FUELS_COLLECTION, record.id);
    const cleanRecord = JSON.parse(JSON.stringify(record));
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: Verifique sua conexão com a internet.")), 15000)
    );
    
    await Promise.race([setDoc(docRef, cleanRecord), timeoutPromise]);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

export const fetchFuelRecords = async (): Promise<FuelRecord[]> => {
  try {
    const q = query(collection(db, FUELS_COLLECTION));
    
    const querySnapshot = await getDocsSmart(q, 'fuels_all');
    const records: FuelRecord[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as FuelRecord;
      
      // Inference for historical data
      if (data.tanqueCheio === undefined) {
        const obs = (data.observations || '').toLowerCase();
        const isFull = obs.includes('completo') || obs.includes('tanque cheio') || obs.includes('enchi');
        data.tanqueCheio = isFull;
        data.tanqueCheioInferido = true;
      }
      
      records.push(data);
    });
    return records.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, FUELS_COLLECTION);
    return [];
  }
};

export const getFuelRecordsByUser = async (userId: string): Promise<FuelRecord[]> => {
  try {
    const q = query(collection(db, FUELS_COLLECTION), where("userId", "==", userId));
    
    const querySnapshot = await getDocsSmart(q, `fuels_user_${userId}`);
    const records: FuelRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push(doc.data() as FuelRecord);
    });
    return records.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, FUELS_COLLECTION);
    return [];
  }
};

// Busca os abastecimentos de um veículo (mais recente primeiro). Usado no
// formulário para saber o último odômetro registrado e impedir retrocesso.
export const getFuelRecordsByVehicle = async (vehicleId: string): Promise<FuelRecord[]> => {
  try {
    const q = query(collection(db, FUELS_COLLECTION), where("vehicleId", "==", vehicleId));
    const snap = await getDocsSmart(q, `fuels_veh_${vehicleId}`);
    const records: FuelRecord[] = [];
    snap.forEach((d) => records.push(d.data() as FuelRecord));
    return records.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const dbt = new Date(b.date).getTime();
      if (dbt !== da) return dbt - da;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, FUELS_COLLECTION);
    return [];
  }
};

export const deleteFuelRecord = async (recordId: string, by?: string): Promise<void> => {
  const path = `${FUELS_COLLECTION}/${recordId}`;
  try {
    await moveToTrash(FUELS_COLLECTION as TrashableCollection, recordId, by);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
};
export const MAINTENANCE_COLLECTION = 'manutencoes';

export const saveMaintenanceRecord = async (record: MaintenanceRecord): Promise<void> => {
  const path = `${MAINTENANCE_COLLECTION}/${record.id}`;
  try {
    await setDoc(doc(db, MAINTENANCE_COLLECTION, record.id), record);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

export const fetchMaintenanceRecords = async (): Promise<MaintenanceRecord[]> => {
  try {
    const q = query(collection(db, MAINTENANCE_COLLECTION));
    
    const querySnapshot = await getDocsSmart(q, 'maint_all');
    const records: MaintenanceRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push(doc.data() as MaintenanceRecord);
    });
    return records.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, MAINTENANCE_COLLECTION);
    return [];
  }
};

export const deleteMaintenanceRecord = async (recordId: string): Promise<void> => {
  const path = `${MAINTENANCE_COLLECTION}/${recordId}`;
  try {
    await deleteDoc(doc(db, MAINTENANCE_COLLECTION, recordId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
};

// --- Gestão de Motoristas (coleção 'drivers') ---
const DRIVERS_COLLECTION = 'drivers';
const DRIVERS_SYNC_KEY = 'sync_time_drivers_all';

export const fetchDrivers = async (): Promise<User[]> => {
  try {
    const q = query(collection(db, DRIVERS_COLLECTION));
    const snap = await getDocsSmart(q, 'drivers_all');
    const drivers: User[] = [];
    snap.forEach((d) => drivers.push(d.data() as User));
    return drivers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, DRIVERS_COLLECTION);
    return [];
  }
};

export const saveDriver = async (driver: User): Promise<void> => {
  const path = `${DRIVERS_COLLECTION}/${driver.id}`;
  try {
    const clean = JSON.parse(JSON.stringify(driver));
    await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), clean);
    localStorage.removeItem(DRIVERS_SYNC_KEY); // força releitura fresca após alteração
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    throw e;
  }
};

export const deleteDriver = async (driverId: string): Promise<void> => {
  const path = `${DRIVERS_COLLECTION}/${driverId}`;
  try {
    await deleteDoc(doc(db, DRIVERS_COLLECTION, driverId));
    localStorage.removeItem(DRIVERS_SYNC_KEY);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    throw e;
  }
};

// Semeia a coleção com a lista fornecida se ela ainda estiver vazia (migração
// única dos motoristas que estavam fixos no código). Devolve a lista resultante.
export const seedDriversIfEmpty = async (seed: User[]): Promise<User[]> => {
  const existing = await fetchDrivers();
  if (existing.length > 0) return existing;
  await Promise.all(seed.map((d) => saveDriver(d)));
  return fetchDrivers();
};
