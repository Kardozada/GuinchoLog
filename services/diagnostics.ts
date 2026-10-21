import { db, authReady } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocsFromServer, query, where, limit } from 'firebase/firestore';

// Linha do tempo de uso do app pelos motoristas: ações principais (abriu o app,
// adicionou serviço, anexou foto, tocou em enviar, erro, aviso...) para entender
// onde um lançamento se perde. Não registra o que é digitado nem a tela.
const COL = 'atividade';
export const ACTIVITY_DAYS = 15;

let ctx: { userId?: string; driverName?: string; role?: string } = {};
export const setTrackUser = (u: { id: string; name: string; role: string } | null) => {
  ctx = u ? { userId: u.id, driverName: u.name, role: u.role } : {};
};

const bundle = () => {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? s.src.split('/').pop() || '' : 'dev';
};

const localDay = (d = new Date()) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD no fuso do aparelho

export interface ActivityEvent {
  id: string;
  userId: string;
  driverName: string;
  evento: string;
  detalhes: Record<string, any>;
  at: string;
  dia: string;
  online: boolean;
  conexao: string | null;
  memoriaGB: number | null;
  versao: string;
}

// Dispara e esquece: nunca trava nem quebra o app. Sem internet, o Firestore
// guarda no aparelho e envia quando a conexão voltar.
export const track = (evento: string, detalhes: Record<string, any> = {}) => {
  try {
    if (!ctx.userId || ctx.role === 'ADMIN') return; // só quem lança (motoristas/mecânicos)
    const nav: any = navigator;
    const at = new Date().toISOString();
    const id = `${at}_${Math.random().toString(36).slice(2, 8)}`;
    const data = JSON.parse(JSON.stringify({
      userId: ctx.userId, driverName: ctx.driverName, evento, detalhes, at, dia: localDay(),
      online: nav.onLine, conexao: nav.connection?.effectiveType ?? null, memoriaGB: nav.deviceMemory ?? null,
      versao: bundle(),
    }));
    authReady.then(() => setDoc(doc(db, COL, id), data)).catch(() => {});
  } catch {
    /* diagnóstico nunca pode atrapalhar o motorista */
  }
};

// Mostra o aviso ao motorista e registra qual aviso foi (validação, bloqueio etc.).
export const avisar = (mensagem: string, tela: string) => {
  track('aviso', { tela, mensagem });
  alert(mensagem);
};

export const fetchActivity = async (dia: string): Promise<ActivityEvent[]> => {
  await authReady;
  const snap = await getDocsFromServer(query(collection(db, COL), where('dia', '==', dia)));
  const out: ActivityEvent[] = [];
  snap.forEach(d => out.push({ id: d.id, ...(d.data() as Omit<ActivityEvent, 'id'>) }));
  return out.sort((a, b) => a.at.localeCompare(b.at));
};

// Descarta eventos com mais de 15 dias (chamado ao abrir a aba de atividade).
export const purgeOldActivity = async () => {
  try {
    await authReady;
    const cutoff = new Date(Date.now() - ACTIVITY_DAYS * 86400000).toISOString();
    const snap = await getDocsFromServer(query(collection(db, COL), where('at', '<', cutoff), limit(300)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
  } catch {
    /* ignora */
  }
};
