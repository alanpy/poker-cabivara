/* Conexión a Firebase (carga diferida: el SDK solo se descarga si se usa la nube) */
const firebaseConfig = {
  apiKey: "AIzaSyAaVseIcHljb67v-bdB-kCZxEWfpsB3Q6k",
  authDomain: "poker-capivara-1fcc4.firebaseapp.com",
  projectId: "poker-capivara-1fcc4",
  storageBucket: "poker-capivara-1fcc4.firebasestorage.app",
  messagingSenderId: "631259742206",
  appId: "1:631259742206:web:1a528d7f3fbf33fe01caaf",
};

let promesa = null;

export function conectarFirebase() {
  if (!promesa) {
    promesa = (async () => {
      const { initializeApp } = await import("firebase/app");
      const {
        initializeFirestore,
        getFirestore,
        persistentLocalCache,
        persistentMultipleTabManager,
        doc,
        onSnapshot,
        setDoc,
        collection,
        getDocs,
      } = await import("firebase/firestore");
      const app = initializeApp(firebaseConfig);
      let db;
      try {
        // cache local persistente: si se corta internet, sigue andando y sincroniza despues
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch (e) {
        db = getFirestore(app);
      }
      return { db, doc, onSnapshot, setDoc, collection, getDocs };
    })();
  }
  return promesa;
}
