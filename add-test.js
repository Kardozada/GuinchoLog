import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
  authDomain: "gen-lang-client-0311459911.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");

async function run() {
  await setDoc(doc(db, "logs", "test-log-123"), {
    id: "test-log-123",
    driverName: "TEST DRIVER",
    date: "2026-08-01",
    timestamp: new Date().toISOString()
  });
  console.log("Success");
  process.exit(0);
}
run();
