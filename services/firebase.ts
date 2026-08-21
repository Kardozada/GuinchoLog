import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
  storageBucket: "gen-lang-client-0311459911.firebasestorage.app",
  messagingSenderId: "1009730744059",
  measurementId: ""
};

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { 
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

// Autenticação anônima: garante que toda chamada ao Firestore leve um token,
// permitindo que as regras exijam login (bloqueando acesso de fora do app).
// authReady resolve quando o login termina (ou falha) — o app espera por ela
// antes de ler do servidor, evitando corrida entre a leitura e o login.
export const auth = getAuth(app);
export const authReady: Promise<void> = signInAnonymously(auth)
  .then(() => undefined)
  .catch((e) => {
    console.warn('Login anônimo do Firebase falhou:', e);
  });

// Suppress Firestore connection warnings
setLogLevel('silent');
