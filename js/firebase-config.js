// Configuración web de Firebase.
//
// IMPORTANTE: estos valores NO son secretos. La config web de Firebase es
// pública por diseño; la seguridad se aplica con las reglas de la Realtime
// Database (ver README / reglas recomendadas). Por eso este archivo se puede
// commitear y desplegar en GitHub Pages.
//
// Para rellenarlo: consola de Firebase -> Configuración del proyecto ->
// "Tus apps" -> app web -> SDK setup and configuration -> Config.
// Asegúrate de crear una Realtime Database (no solo Firestore) y de copiar
// aquí su `databaseURL`.

export const firebaseConfig = {
  apiKey: "AIzaSyBnAMs92LgaREFn3XU6lgTFRG1kmt3Nemc",
  authDomain: "sumo-drift.firebaseapp.com",
  // OBLIGATORIO para la Realtime Database. Créala en la consola
  // (Build -> Realtime Database -> Crear) y copia aquí su URL. Suele ser
  // "https://sumo-drift-default-rtdb.firebaseio.com" (EE.UU.) o
  // "https://sumo-drift-default-rtdb.europe-west1.firebasedatabase.app" (Europa).
  databaseURL: "https://sumo-drift-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sumo-drift",
  storageBucket: "sumo-drift.firebasestorage.app",
  messagingSenderId: "594212019264",
  appId: "1:594212019264:web:6c97933a764b14775153a5",
  measurementId: "G-82MVLEL1E2"
};

// ¿Está configurado? Se usa para mostrar un aviso amable si aún tiene placeholders.
export const firebaseReady =
  typeof firebaseConfig.databaseURL === "string" && !firebaseConfig.databaseURL.includes("TODO_");
