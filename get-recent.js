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
  const q = query(collection(db, "logs"), orderBy("date", "desc"), limit(10));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(doc.id, doc.data().date, doc.data().driverName);
  });
  process.exit(0);
}
check();
