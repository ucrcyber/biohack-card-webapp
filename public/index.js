import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-analytics.js";
import { getDatabase, ref, get, set, push, child, onChildAdded, onValue } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-database.js";
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

function addButton({ parentElement, label, callback }){
    const button = document.createElement('button');
    button.innerText = label;
    button.addEventListener('click', callback);
    parentElement.append(button);
}

function trackReader({id, name, active, lastCard, lastCardTime}){
    const div = document.createElement('div');
    div.innerText = id;
    const label = document.createElement('div');
    onValue(child(ref(database), `readers/${id}/n`), snapshot => label.innerText = `${name=snapshot.val()} ${lastCard} @ ${new Date(lastCardTime)}`, console.error);
    onValue(child(ref(database), `readers/${id}/c`), snapshot => label.innerText = `${name} ${lastCard=snapshot.val()} @ ${new Date(lastCardTime)}`, console.error);
    onValue(child(ref(database), `readers/${id}/t`), snapshot => label.innerText = `${name} ${lastCard} @ ${new Date(lastCardTime=snapshot.val())}`, console.error);

    const activeCheckbox = document.createElement('input');
    activeCheckbox.type = "checkbox";
    onValue(child(ref(database), `readers/${id}/a`), snapshot => activeCheckbox.checked = active = snapshot.val(), console.error);

    div.append(label, activeCheckbox);
    addButton({
        parentElement: div,
        label: "Register card",
        callback: () => {
            const cardholder = prompt(`Enter the cardholder email.`);
            set(child(ref(database), `cards/${lastCard}`), {
                ch: cardholder,
                a: true,
            });
        },
    });
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
function trackCard({ id }){
    const div = document.createElement('div');
    div.innerText = id;
    const label = document.createElement('div');
    onValue(child(ref(database), `cards/${id}/ch`), snapshot => label.innerText = snapshot.val(), console.error);

    const activeCheckbox = document.createElement('input');
    activeCheckbox.type = "checkbox";
    onValue(child(ref(database), `cards/${id}/a`), snapshot => activeCheckbox.checked = snapshot.val(), console.error);

    div.append(label, activeCheckbox);
    document.querySelector('#cardList').append(div);
    
    label.addEventListener('click', event => {
        const newName = prompt(`Enter a new cardholder name.`);
        if(newName)
            set(child(ref(database), `cards/${id}/n`), newName).catch(console.error);
    });
    activeCheckbox.addEventListener('change', () => {
        set(child(ref(database), `cards/${id}/a`), activeCheckbox.checked).catch(console.error);
    });
}

let loggedInOnce = false;
auth.onAuthStateChanged(user => {
    document.querySelector('#login').style.display = user ? "none" : "block";
    if(user && !loggedInOnce){
        onChildAdded(child(ref(database), `readers`), (snapshot) => {
            const id = snapshot.key;
            const reader = snapshot.val();
            const [name, active, lastCard, lastCardTime] = ["n", "a", "c", "t"].map(k => reader[k]);
            trackReader({ id, name, active, lastCard, lastCardTime });
        }, console.error);
        onChildAdded(child(ref(database), `cards`), (snapshot) => {
            const id = snapshot.key;
            trackCard({ id });
        }, console.error);
        loggedInOnce = true;
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