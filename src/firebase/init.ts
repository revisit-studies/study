// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAm9QtUgx1lYPDeE0vKLN-lK17WfUGVkLo",
  authDomain: "revisit-utah.firebaseapp.com",
  projectId: "revisit-utah",
  storageBucket: "revisit-utah.appspot.com",
  messagingSenderId: "811568460432",
  appId: "1:811568460432:web:995f6b4f1fc8042b5dde15",
};

export function initFirebase() {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const fStore = getFirestore(app);

  const connectBeat = doc(fStore, "connection", "beat");

  setDoc(connectBeat, {
    "last-ping": new Date(),
  });

  return {
    app,
    fStore,
  };
}
