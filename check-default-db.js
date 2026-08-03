import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const logsSnap = await getDocs(collection(db, "logs"));
    console.log("Logs count in default db:", logsSnap.size);
    
    let countYesterday = 0;
    logsSnap.forEach(doc => {
      const data = doc.data();
      if (data.date === '2026-07-31') countYesterday++;
    });
    console.log("Logs from 2026-07-31:", countYesterday);
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
