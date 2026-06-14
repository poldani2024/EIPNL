import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase. La config web de Firebase NO es secreta:
// está pensada para vivir en el cliente. Aun así, se puede sobreescribir
// con variables de entorno NEXT_PUBLIC_* en el build si se desea.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBN5IhxhSXjai7fYTaBecPgGdgjDOSqz58',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'eipnl-7ad3d.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'eipnl-7ad3d',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'eipnl-7ad3d.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1051053986016',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1051053986016:web:494f44bc4fcc8a7d884085',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-ZTJSHKR2J3',
};

// Evita reinicializar la app en hot-reload / múltiples imports.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// La base de datos Firestore tiene un ID propio (no el '(default)').
// Se puede sobreescribir con NEXT_PUBLIC_FIREBASE_DATABASE_ID en el build.
const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'eipnl-turnos';

export const db = getFirestore(app, databaseId);
