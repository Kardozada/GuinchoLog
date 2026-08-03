import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
};

const app1 = initializeApp(firebaseConfig, "app1");
const db1 = initializeFirestore(app1, {});

const app2 = initializeApp(firebaseConfig, "app2");
const db2 = initializeFirestore(app2, {});

console.log((db1 as any)._databaseId?.projectId, (db1 as any)._databaseId?.database);
console.log((db2 as any)._databaseId?.projectId, (db2 as any)._databaseId?.database);
