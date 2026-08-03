import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0311459911",
  appId: "1:1009730744059:web:d0fd80a77956c88914ca5e",
  apiKey: "AIzaSyBaVlhad_jgs-Gba-P61NsjhLB4N0u6k_w",
};

const app = initializeApp(firebaseConfig);
const db1 = initializeFirestore(app, {}, "ai-studio-guincholog-06b9d500-263f-4258-8277-7b3446b09a6f");
try {
  const db2 = initializeFirestore(app, {}, "(default)");
  console.log("Success! Both initialized.");
} catch(e) {
  console.error("Error:", e);
}
