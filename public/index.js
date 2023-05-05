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

const qrcode = new QRCode(document.getElementById("qrcode"), {
  width: 512,
  height: 512,
  colorDark: "#000",
  colorLight: "#fff",
  correctLevel: QRCode.CorrectLevel.H,
});
qrcode.clear();

document.querySelector('#login').addEventListener('click', async () => {
  const {user} = await signInWithPopup(auth, provider);
  await update(child(ref(database), `users/${user.uid}`), {
    e: user.email,
    t: serverTimestamp(),
  });
  console.log('success');
  document.querySelector('#login').style.display = 'none';
  const userSnapshot = (await get(child(ref(database), `users/${user.uid}`))).val(); // e, p, t
  if(userSnapshot.p){ // operator
    // load up web
    loadReaderApplication();
  } else { // participant
    console.log(userSnapshot.e, userSnapshot.t); // for data
    try {
      const userdataSnapshot = (await get(child(ref(database), `data/${userSnapshot.e.replaceAll('.','@')}`))).val(); // e, pii
      console.log("(usercheck) Pass");
      console.log(userdataSnapshot);
      
      qrcode.makeCode(`${window.location.origin}/?data=${encodeURIComponent(`${userSnapshot.e},${userSnapshot.t}`)}`);
    } catch(error) {
      console.warn("(usercheck) Fail");
      updateFeedback("This email is not associated with any registered participants. Please log in with the ucr.edu or gmail account you used to register.");
    }
  }
});

load();
function load(){
  const params = {};
  window.location.href
    .replace(/[^\?]+\?/, "")
    .split("&")
    .map((x) => x.split("="))
    .map(([k, v]) => (params[k] = decodeURIComponent(v)));
  console.log(params);
  if(localStorage.getItem('peer') || params.peer){ // in peer mode
    console.log('i am peripheral');
    document.querySelector('#login').style.display = 'none';

    const peer = new Peer();
    if(params.peer) localStorage.setItem('peer', params.peer);
    updateFeedback("[1/4] connecting ...");
    peer.on("open", (id) => {
      updateFeedback("[2/4] connecting ...");
      const connection = peer.connect(window.localStorage.getItem("peer"));
      connection.on("open", () => {
        updateFeedback("[3/4] connected! sending payload now");
        connection.send(params.data || "null");
      });
      connection.on("data", () => connection.close());
      connection.on("close", () => updateFeedback("[4/4] connection closed; you can close the page now"));
    });
    const peerCancel = document.createElement("button");
    peerCancel.innerText = "Reset";
    peerCancel.onclick = () => {
      window.history.pushState(null, "", "?");
      window.localStorage.removeItem("peer");
      window.location.reload();
    };
    document.body.append(peerCancel);
  }
}

function updateFeedback(text){
  document.querySelector('#feedback').innerText = text;
}
function loadReaderApplication(){
  let currentCard = null;
  const container = document.createElement("div");
  const peerReconnect = document.createElement("button");
  peerReconnect.innerText = "Reconnect";
  peerReconnect.disabled = true;
  const openReaderButton = document.createElement("button");
  openReaderButton.innerText = "Request Serial";
  openReaderButton.onclick = async () => {
    // open port (do it once and you can refresh as many times as you want)
    // reading something
    try {
      const decoder = new TextDecoder();
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });

      openReaderButton.disabled = true;

      let o = "";
      if (port.readable) {
        const reader = port.readable.getReader();
        updateFeedback("Connected to reader!");
        try {
          while (true) {
            const { value, done } = await reader.read();
            //console.log("reading");
            if (done) {
              // |reader| has been canceled.
              break;
            }
            // Do something with |value|...
            //decoder.decode(value).then(console.log);
            // console.log(value);
            o += decoder.decode(value);
            // parse output
            const lines = o.split('\n');
            o = lines.splice(-1); // leave the last line in buffer
            for(let line of lines){ // parse lines
              if(line.startsWith("CARD ID: ")){
                const matchResult = line.match(/[0-9]+/);
                if(matchResult && matchResult[0]) currentCard = (matchResult[0]);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        reader.releaseLock();
        port.close();
        console.log(o);
        openReaderButton.disabled = false;
      }
    }catch(err){
      updateFeedback("failed to open port " + err);
    }
  };

  const peer = new Peer();
  peer.on("open", (id) => {
    if(!navigator.serial){
      if(location.href.startsWith("http://")) location.replace(location.href.replace('http', 'https'));
      alert("Serial API not found, make sure you are on a chromium based browser and are using https");
    }

    qrcode.makeCode(`${window.location.origin}/?peer=${encodeURIComponent(id)}`);
    peerReconnect.onclick = () => {
      qrcode.makeCode(`${window.location.origin}/?peer=${encodeURIComponent(id)}`);
      peerReconnect.disabled = true;
    };
    peer.on("connection", (connection) => {
      console.log(qrcode);
      qrcode.clear();
      peerReconnect.disabled = false;
      // Receive messages
      connection.on("data", (data) => {
        console.log("Received", data);
        connection.send("ok");
        connection.close();
      });
      connection.on("open", () => console.log(" >!!", connection.peer));
      connection.on("close", () => console.log("<--<", connection.peer));
      console.log(" >>>", connection.peer);
    });
  });

  container.append(openReaderButton, peerReconnect);
  document.body.append(container);
}