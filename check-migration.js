import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, getDocsFromCache, setDoc, doc, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const migrationApp = initializeApp(firebaseConfig, "migration-app");
let defaultDb;
try {
  defaultDb = initializeFirestore(migrationApp, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
  });
} catch (e) {
  defaultDb = getFirestore(migrationApp);
}

async function run() {
  try {
     const logsSnap = await getDocsFromCache(collection(defaultDb, "logs"));
     console.log("Cached logs:", logsSnap.size);
     
     logsSnap.forEach(doc => {
       const data = doc.data();
       if (data.date === '2024-07-31' || data.date === '2026-07-31') {
         console.log("Found cached log for 07-31:", doc.id);
       }
     });
  } catch (err) {
     console.log("Error getting cache:", err);
  }
  process.exit(0);
}
run();
