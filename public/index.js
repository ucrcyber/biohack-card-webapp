import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-analytics.js";
import { getDatabase, ref, get, set, update, push, child, onChildAdded, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyB4I24y3TDm4W_a3NNQCoDsWxY2Ti1uLjE",
    authDomain: "biohack-19937.firebaseapp.com",
    databaseURL: "https://biohack-19937-default-rtdb.firebaseio.com",
    projectId: "biohack-19937",
    storageBucket: "biohack-19937.appspot.com",
    messagingSenderId: "330252243764",
    appId: "1:330252243764:web:db496ee0096b57226e0b61",
    measurementId: "G-QQ7E0X7RGW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();

document.querySelector('#login').addEventListener('click', async () => {
  const {user} = await signInWithPopup(auth, provider);
  await update(child(ref(database), `users/${user.uid}`), {
    e: user.email,
    t: serverTimestamp(),
  });
  console.log('success');
  document.querySelector('#login').style.display = 'none';
  const userSnapshot = (await get(child(ref(database), `users/${user.uid}`))).val(); // e, p, t
  if(p < 1){ // participant
    console.log(userSnapshot.e, userSnapshot.t); // for data
  } else { // operator
    // load up web
  }
});