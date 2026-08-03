import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

async function run() {
  const q = query(collection(db, "logs"));
  const snap = await getDocs(q);
  let countServicesMissing = 0;
  let countExpensesMissing = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.services === undefined) countServicesMissing++;
    if (data.expenses === undefined) countExpensesMissing++;
  });
  console.log("Missing services:", countServicesMissing);
  console.log("Missing expenses:", countExpensesMissing);
  process.exit(0);
}
run();
