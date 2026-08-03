import React, { useEffect, useState } from 'react';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, getDocsFromCache, setDoc, doc, getFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { app as defaultApp, db as customDb } from '../services/firebase';

const DataMigrator: React.FC = () => {
  const [status, setStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    const migrateData = async () => {
      if (localStorage.getItem('migrated_07_31_v5')) {
        return;
      }
      try {
        let defaultDb;
        try {
          defaultDb = initializeFirestore(defaultApp, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
              cacheSizeBytes: CACHE_SIZE_UNLIMITED
            })
          }, "(default)");
        } catch (e: any) {
          if (e.message && (e.message.includes('already been called') || e.message.includes('already initialized'))) {
            defaultDb = getFirestore(defaultApp, "(default)");
          } else {
            throw e;
          }
        }

        const logsSnap = await getDocsFromCache(collection(defaultDb, "logs")).catch((e) => {
          console.warn("No logs cache", e);
          return { docs: [] };
        });
        const fuelsSnap = await getDocsFromCache(collection(defaultDb, "abastecimentos")).catch(() => ({ docs: [] }));
        const maintSnap = await getDocsFromCache(collection(defaultDb, "manutencoes")).catch(() => ({ docs: [] }));
        
        let migratedCount = 0;
        for (const document of logsSnap.docs) {
          try {
             await setDoc(doc(customDb, "logs", document.id), document.data());
             migratedCount++;
          } catch(e) { console.error(e) }
        }
        for (const document of fuelsSnap.docs) {
          try {
             await setDoc(doc(customDb, "abastecimentos", document.id), document.data());
             migratedCount++;
          } catch(e) { console.error(e) }
        }
        for (const document of maintSnap.docs) {
          try {
             await setDoc(doc(customDb, "manutencoes", document.id), document.data());
             migratedCount++;
          } catch(e) { console.error(e) }
        }
        
        localStorage.setItem('migrated_07_31_v5', 'true');
        
        if (migratedCount > 0 && mounted) {
          setStatus(`Recuperados ${migratedCount} registros salvos offline!`);
          setTimeout(() => { if(mounted) setStatus('') }, 10000);
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    };
    
    migrateData();
    return () => { mounted = false; };
  }, []);

  if (!status) return null;
  return (
    <div className="bg-indigo-600 text-white p-3 text-center text-sm font-bold shadow-lg">
      {status}
    </div>
  );
}

export default DataMigrator;
