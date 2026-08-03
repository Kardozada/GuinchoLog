import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig, "default-check");
const defaultDb = initializeFirestore(app, {});

async function run() {
  const q = query(collection(defaultDb, "logs"));
  try {
     const snap = await getDocs(q);
     console.log("Default DB Logs Count:", snap.size);
     let countJuly31 = 0;
     snap.forEach(doc => {
       const data = doc.data();
       if (data.date === '2024-07-31' || data.date === '2025-07-31' || data.date === '2026-07-31') {
          countJuly31++;
          console.log("Found log:", doc.id, data.date, data.userId);
       }
     });
     console.log("Logs from July 31st:", countJuly31);
  } catch(e) {
     console.log("Error querying default db:", e);
  }
  process.exit(0);
}
run();
