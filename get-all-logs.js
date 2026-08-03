import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

async function check() {
  const q = query(collection(db, "logs"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  console.log("Total logs in custom DB:", snap.size);
  let count31 = 0;
  let count01 = 0;
  snap.forEach(doc => {
    if (doc.data().date === '2026-07-31') count31++;
    if (doc.data().date === '2026-08-01') count01++;
  });
  console.log("Count 07-31:", count31, "Count 08-01:", count01);
  process.exit(0);
}
check();
