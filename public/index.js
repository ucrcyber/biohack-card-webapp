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

let peripheralData, readerData, registeredEvent, registeredEventElement;
const provider = new GoogleAuthProvider();

const qrcode = new QRCode(document.getElementById("qrcode"), {
  width: 512,
  height: 512,
  colorDark: "#000",
  colorLight: "#fff",
  correctLevel: QRCode.CorrectLevel.H,
});
document.getElementById("qrcode").addEventListener('click', () => qrcodeDisplay());
qrcodeDisplay();
function qrcodeDisplay(code){
  console.log("qrUpdate", code);
  const qrcodeElement = document.getElementById("qrcode");
  qrcodeElement.style.display = code ? "flex" : "none";
  qrcodeElement.style.zIndex = code ? 1 : -1;
  qrcode.makeCode(code || ""); // reset qrcode display
}

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
      
      qrcodeDisplay(`${window.location.origin}/?data=${encodeURIComponent(`${user.uid},${userSnapshot.t}`)}`);
      updateFeedback("Show this QR code at check-in.");
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
function updatePeripheralData(data){
  const div = document.querySelector("#peripheralData");
  if(!peripheralData !== !data){
    div.style.animation = 'none';
    div.offsetHeight; /* trigger reflow */
    div.style.animation = ''; 
    div.style.animationDelay = '0s';
  }
  div.style.background = data ? "darkgreen" : "darkred";
  div.innerText = data ? "User OK" : "no user";
  peripheralData = data;
  updateLinkStatus();
}
function updateReaderData(data){
  const div = document.querySelector("#readerData");
  if(!readerData !== !data){
    div.style.animation = 'none';
    div.offsetHeight; /* trigger reflow */
    div.style.animation = '';
    div.style.animationDelay = '0s';
  }
  if(readerData !== data && data){ // different data?
    console.log("NEW CARD!", data, registeredEvent);
    if(registeredEvent){
      get(child(ref(database), `cards/${data}/e`)).then(async snapshot => {
        const owner = snapshot.val();
        push(child(ref(database), `re`), {
          t: serverTimestamp(),
          c: owner,
          e: registeredEvent, // event id
        });
        set(child(ref(database), `data/${owner.replaceAll('.','@')}/a/${registeredEvent}`), 1 + 
          ((await get(child(ref(database), `data/${owner.replaceAll('.','@')}/a/${registeredEvent}`))).val() || 0)
        );
      });
    }
  }
  div.style.background = data ? "darkgreen" : "darkred";
  div.innerText = data ? "Card OK" : "no card scanned";
  readerData = data;
  updateLinkStatus();
}
function updateLinkStatus(){
  const button = document.querySelector('#linkCards');
  button.disabled = !(readerData && peripheralData);
}
function loadReaderApplication(){
  let currentCard = null;
  const container = document.createElement("div");
  container.classList.add('actionBar');
  const peerReconnect = document.createElement("button");
  peerReconnect.innerText = "QR Connect";
  // peerReconnect.disabled = true; // require manual (usually its not required)
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

  const linkCardsButton = document.createElement("button");
  linkCardsButton.id = "linkCards";
  linkCardsButton.innerText = "Link to card";
  linkCardsButton.disabled = true;
  linkCardsButton.addEventListener('click', async () => {
    console.log("DATAS", peripheralData, readerData);

    // TODO : handle reassigning an already assigned card
    update(child(ref(database), `cards/${readerData}`), { e: peripheralData.email });
    update(child(ref(database), `data/${peripheralData.emailAsKey}`), { card: readerData });

    updatePeripheralData();
    updateReaderData();
  });

  const peripheralDataStatus = document.createElement("div");
  peripheralDataStatus.classList.add('statusBar');
  peripheralDataStatus.id = "peripheralData";

  const readerDataStatus = document.createElement("div");
  readerDataStatus.classList.add('statusBar');
  readerDataStatus.id = "readerData";

  const peer = new Peer();
  peer.on("open", (id) => {
    if(!navigator.serial){
      if(location.href.startsWith("http://")) location.replace(location.href.replace('http', 'https'));
      alert("Serial API not found, make sure you are on a chromium based browser and are using https");
    }

    // qrcodeDisplay(`${window.location.origin}/?peer=${encodeURIComponent(id)}`);
    peerReconnect.onclick = () => {
      qrcodeDisplay(`${window.location.origin}/?peer=${encodeURIComponent(id)}`);
      peerReconnect.disabled = true;
    };
    peer.on("connection", (connection) => {
      // console.log(qrcode);
      qrcodeDisplay();
      peerReconnect.disabled = false;
      // Receive messages
      connection.on("data", async (data) => {
        console.log("Received", data);
        connection.send("ok");
        connection.close();
        
        const [uid, time] = data.split(','); // what client claims
        try {
          // try to map userid to user metadata
          const userEmail = (await get(child(ref(database), `users/${uid}/e`))).val(); // what server says
          const timeUpdate = (await get(child(ref(database), `users/${uid}/t`))).val(); // what server says
          if(userEmail === null || timeUpdate === null) return updateFeedback("Invalid code, this account does not exist");
          if(+time !== timeUpdate) return updateFeedback("Invalid code (timestamp mismatch), ask for user to reload page");
          // try to get user data
          const userdataSnapshot = (await get(child(ref(database), `data/${userEmail.replaceAll('.','@')}`))).val(); // e, pii
          if(userdataSnapshot === null) return updateFeedback("Invalid code (no data for user), user is not registered for the event");
          // its all good
          updateFeedback(`Valid user data recieved ${userEmail} ${uid} ${userdataSnapshot}`);
          updatePeripheralData({
            email: userEmail,
            emailAsKey: userEmail.replaceAll('.','@'),
            uid,
            user: userdataSnapshot,
          });
        } catch (err){
          updateFeedback(`Invalid code (no data for user), user is not registered\n${err}`);
        }

      });
      // connection.on("open", () => console.log(" >!!", connection.peer));
      // connection.on("close", () => console.log("<--<", connection.peer));
      // console.log(" >>>", connection.peer);
    });
  });

  const newEventButton = document.createElement('button');
  newEventButton.innerText = "+ Event";
  // newEventButton.style.position = 'absolute';
  newEventButton.addEventListener('click', () => {
    const payload = prompt("Name of new event? (at least 5 characters)");
    if(payload?.length >= 5){
      push(child(ref(database), `events`), {
        n: payload,
        d: "placeholder description (click to edit)",
      });
    }
  });

  const eventContainer = document.createElement('div');
  eventContainer.classList.add('eventContainer');
  onChildAdded(child(ref(database), `events`), (snapshot) => {
    const id = snapshot.key;
    const snapshotValue = snapshot.val();
    let [name, description] = ["n", "d"].map(k => snapshotValue[k]);
    const eventBar = document.createElement('div');
    eventBar.classList.add('event');

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('title');
    onValue(child(ref(database), `events/${id}/n`), snapshot => nameDiv.innerText = `${name=snapshot.val()}`, console.error);
    nameDiv.onclick = () => {
      const payload = prompt(`Enter a new name for event ${name}`);
      if(payload) update(child(ref(database), `events/${id}/n`), payload);
    };

    const descriptionDiv = document.createElement('div');
    descriptionDiv.classList.add('description');
    onValue(child(ref(database), `events/${id}/d`), snapshot => descriptionDiv.innerText = `${description=snapshot.val()}`, console.error);
    descriptionDiv.onclick = () => {
      const payload = prompt(`Enter a new description for event ${name}\nOld description: ${description}`);
      if(payload) update(child(ref(database), `events/${id}/n`), payload);
    };
    const selectEventButton = document.createElement('button');
    selectEventButton.innerText = 'Select';
    selectEventButton.addEventListener('click', () => {
      if(registeredEventElement) registeredEventElement.classList.remove('selected'); // use css psuedoselectors and pointer-events to disable selected element
      registeredEventElement = eventBar;
      registeredEventElement.classList.add('selected');
      registeredEvent = id;

      // if you ever select, you dont need to link cards anymore (probably)
      container.classList.add('floatUp');
    });

    eventBar.append(nameDiv, descriptionDiv, selectEventButton);
    eventContainer.append(eventBar);
}, console.error);

  container.append(openReaderButton, peerReconnect, peripheralDataStatus, readerDataStatus, linkCardsButton);
  container.append(newEventButton);
  document.body.append(container, eventContainer);

  // for testing
  peripheralDataStatus.onclick = () => updatePeripheralData({
    email: "test@test.test",
    emailAsKey: "test@test.test".replaceAll('.','@'),
    uid: "testaccount",
    user: {
      "e": "test@test.test",
      "pii": "datadata",
    },
  });
  readerDataStatus.onclick = () => updateReaderData("testcardnumber");
  updatePeripheralData();
  updateReaderData("testcardnumber");
}