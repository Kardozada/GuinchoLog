import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

async function check() {
  try {
    const logsSnap = await getDocs(collection(db, "logs"));
    console.log("Logs count in custom db:", logsSnap.size);
    
    let countYesterday = 0;
    logsSnap.forEach(doc => {
      const data = doc.data();
      if (data.date === '2026-07-31' || data.date === '2026-08-01') {
        console.log("Found log for", data.date, "by", data.driverName, "expenses:", data.expenses?.length);
      }
    });
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
