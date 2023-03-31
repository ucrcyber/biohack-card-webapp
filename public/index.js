import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-analytics.js";
import { getDatabase, ref, set, get, child, onChildAdded, onValue } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js";

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

function clearChildren(htmlElement){
    while(htmlElement.firstChild){
        htmlElement.removeChild(htmlElement.firstChild);
    }
}

function trackReader({id, name, active, lastCard, lastCardTime}){
    const div = document.createElement('div');
    div.classList.add('reader');
    div.innerText = id;
    const label = document.createElement('div');
    onValue(child(ref(database), `readers/${id}/n`), snapshot => label.innerText = `${name=snapshot.val()} ${lastCard} @ ${new Date(lastCardTime)}`, console.error);
    onValue(child(ref(database), `readers/${id}/c`), snapshot => label.innerText = `${name} ${lastCard=snapshot.val()} @ ${new Date(lastCardTime)}`, console.error);
    onValue(child(ref(database), `readers/${id}/t`), snapshot => label.innerText = `${name} ${lastCard} @ ${new Date(lastCardTime=snapshot.val())}`, console.error);

    const activeCheckbox = document.createElement('input');
    activeCheckbox.type = "checkbox";
    onValue(child(ref(database), `readers/${id}/a`), snapshot => activeCheckbox.checked = active = snapshot.val(), console.error);

    div.append(label, activeCheckbox);
    document.querySelector('#deviceList').append(div);
    
    div.addEventListener('click', event => {
        if(!event.altKey) return;
        const newName = prompt(`Enter a new name for reader ${name}`);
        if(newName)
            set(child(ref(database), `readers/${id}/n`), newName).catch(console.error);
    });
    activeCheckbox.addEventListener('change', () => {
        set(child(ref(database), `readers/${id}/a`), activeCheckbox.checked).catch(console.error);
    });
}

auth.onAuthStateChanged(user => {
    document.querySelector('#login').style.display = user ? "none" : "block";
    if(user){
        onChildAdded(child(ref(database), `readers`), (snapshot) => {
            const id = snapshot.key;
            const reader = snapshot.val();
            const [name, active, lastCard, lastCardTime] = ["n", "a", "c", "t"].map(k => reader[k]);
            trackReader({ id, name, active, lastCard, lastCardTime });
        }, console.error);
    }
});

document.querySelector('#loginButton').addEventListener('click', () => {
    const username = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;
    signInWithEmailAndPassword(auth, username, password).then(() => {
        // auth state changed does its thing
    }).catch(({ code, message }) => {
        alert(`Login fail: ${message}`);
    });
});