
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDlqYlkllQyrUTUSJB_4M8BHiWejqe1T1o",
  authDomain: "my-media-gallery-3f535.firebaseapp.com",
  projectId: "my-media-gallery-3f535",
  storageBucket: "my-media-gallery-3f535.firebasestorage.app",
  messagingSenderId: "639101271846",
  appId: "1:639101271846:web:a1c326b337d1e235278be7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
