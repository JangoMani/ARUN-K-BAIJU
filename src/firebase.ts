import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyDHoQXsARegYfaeD-rq78XzDOf-3cr91fw",
  authDomain: "ca-final-mentoring.firebaseapp.com",
  projectId: "ca-final-mentoring",
  storageBucket: "ca-final-mentoring.firebasestorage.app",
  messagingSenderId: "927620693958",
  appId: "1:927620693958:web:a88d152843fd554d32fcc7",
  measurementId: "G-L2WT2QGMWN"
};

// Initialize Firebase app if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Enable offline persistence if supported
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence.');
    }
  });
} catch (e) {
  // Ignore error if persistence fails
}
