import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

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

// Suppress Firestore connection warnings
setLogLevel('silent');
