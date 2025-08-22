// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAPZbuA53roUuoSTMMCIPerlx4VXhUJEQo",
  authDomain: "fir-95682.firebaseapp.com",
  projectId: "fir-95682",
  storageBucket: "fir-95682.firebasestorage.app",
  messagingSenderId: "237326786061",
  appId: "1:237326786061:web:d90932b9d1ba680230bf44"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export {auth,db};