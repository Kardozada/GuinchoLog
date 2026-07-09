import { DailyLog, User } from '../types';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query } from 'firebase/firestore';

const USER_KEY = 'guincholog_user';
const LOGS_COLLECTION = 'logs';

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: Verifique sua conexão com a internet.")), 15000)
    );
    
    const querySnapshot = await Promise.race([getDocs(q), timeoutPromise]);
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
  const all = await fetchLogsFromFirestore();
  return all.filter(log => {
    const matchId = log.userId === userId;
    const matchName = driverName && log.driverName && log.driverName.trim().toLowerCase() === driverName.trim().toLowerCase();
    return matchId || matchName;
  });
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