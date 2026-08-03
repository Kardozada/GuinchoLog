import { DailyLog, User, FuelRecord, MaintenanceRecord } from '../types';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, getDocsFromCache, deleteDoc, query, where } from 'firebase/firestore';

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

// --- Leitura otimizada (economia de cota) ---
// A cota gratuita do Firestore conta CADA documento lido do servidor. Ler a
// coleção inteira a cada abertura de tela consome milhares de leituras por dia.
// Estratégia: usar o cache local (já persistido) como fonte primária e só
// consultar o servidor quando o cache está vazio ou quando passou o "cooldown"
// desde a última sincronização — cortando drasticamente as leituras faturadas.
const SYNC_PREFIX = 'guincholog_lastsync_';
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

async function getDocsSmart(q: any, cacheKey: string, cooldownMs: number = DEFAULT_COOLDOWN_MS) {
  const now = Date.now();
  const lastSyncStr = localStorage.getItem(SYNC_PREFIX + cacheKey);
  const lastSync = lastSyncStr ? Number(lastSyncStr) : 0;
  const withinCooldown = now - lastSync < cooldownMs;

  // Dentro do cooldown: tenta servir do cache local (0 leituras faturadas).
  // Escritas locais (setDoc/deleteDoc) já atualizam esse cache, então dados
  // recém-salvos aparecem mesmo sem ir ao servidor.
  if (withinCooldown) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return cached;
      }
      // Cache vazio -> segue para o servidor.
    } catch (cacheError) {
      // Cache indisponível -> segue para o servidor.
    }
  }

  // Leitura do servidor (também reabastece o cache local).
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 15000)
    );
    const fresh = await Promise.race([getDocs(q), timeoutPromise]);
    localStorage.setItem(SYNC_PREFIX + cacheKey, String(now));
    return fresh;
  } catch (error) {
    // Servidor falhou (offline ou cota): cai no cache como último recurso.
    console.warn("Read failed (quota or network), falling back to cache.", error);
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

export const updateLog = async (log: DailyLog): Promise<void> => {
  await saveLog(log);
};

export const deleteLog = async (logId: string): Promise<void> => {
  const path = `${LOGS_COLLECTION}/${logId}`;
  try {
    await deleteDoc(doc(db, LOGS_COLLECTION, logId));
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

export const deleteFuelRecord = async (recordId: string): Promise<void> => {
  const path = `${FUELS_COLLECTION}/${recordId}`;
  try {
    await deleteDoc(doc(db, FUELS_COLLECTION, recordId));
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
