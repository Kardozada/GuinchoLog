import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig, "current-check");
const customDb = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

async function run() {
  const q = query(collection(customDb, "logs"));
  const snap = await getDocs(q);
  console.log("Current DB Logs Count:", snap.size);
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.date === '2026-07-31') {
       console.log("Found log on 2026-07-31:", doc.id, data.userId);
    }
  });
  process.exit(0);
}
run();
