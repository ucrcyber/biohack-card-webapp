import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-analytics.js";
import { getDatabase, ref, get, set, update, push, child, onChildAdded, onValue, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const SoundFileAliases = {
  "popup": "Menu Open 3.mp3",
  "popup-away": "Menu Close 2.mp3",
  "card-scan": "Quest Notification 2.mp3",
  "phone-scan-pass": "Quest Notification 1.mp3",
  "phone-scan-fail": "Notification 4.mp3",
  "button-onclick": "Select.mp3",
  "button-onclick-disabled": "Wrong Answer.mp3",
  "change-desc": "Menu Click 1.mp3",
  "select-event": "Menu Open 2.mp3",
  "link-card": "Sparkle Swoosh 1.mp3",
};
const Sounds = {};
document.body.addEventListener('click', setupSounds);
function setupSounds(){
  if(Object.keys(Sounds) > 0) return;
  for(const [k, v] of Object.entries(SoundFileAliases)){
    Sounds[k] = Sounds[k.replace(/-([a-z])/g, (a,g1) => g1.toUpperCase())] = new Howl({
      src: [`sfx/${v}`],
      // onload: () => console.log("finish loading", v),
      // onloaderror: (i, a) => console.error("error loading", v, i, a),
    });  
  }
  document.body.addEventListener('click', (e) => {
    // console.log(e.target, e.target.getAttribute('disabled'));
    const { classList } = e.target;
    if(e.target.tagName === "BUTTON"){
      if(!e.target.getAttribute('disabled') && !e.target.classList.contains('disabled')){
        if(!e.target.classList.contains('customSuccessSfx')){
          Sounds['buttonOnclick'].play();
        }
      } else {
        if(!e.target.classList.contains('customFailSfx')){
          Sounds['buttonOnclickDisabled'].play();
        }
      }
    }
  });
  document.body.removeEventListener('click', setupSounds);
}

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

function replayAnimation(htmlElement){
  htmlElement.style.animation = 'none';
  htmlElement.offsetHeight; /* trigger reflow */
  htmlElement.style.animation = '';
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
async function updateCardResult(data){
  const existing = document.querySelector('div.slideIn.cardResult:not(.discard)');
  if(existing){
    await sleep(200); // stagger result update to let click sfx finish before starting next action
    existing.classList.add('discard');
    existing.style.transform = 'translateX(1em)';
    existing.style.animationName = existing.style.animationDelay = '';
    Sounds['popupAway']?.play();
    sleep(1000).then(() => existing.remove());
  }
  
  [...document.querySelectorAll('.event>.counter:not(.globalCounter)')].forEach(counterElement => {
    counterElement.style.animationName = 'flickerOut';
    counterElement.innerText = '0';
  });
  if(data){
    const div = document.createElement('div');
    div.classList.add('slideIn', 'cardResult');
    // div.innerText = JSON.stringify(data);
    const userData = JSON.parse(data.pii) || ["unknown", "-", "-"];
    const userDataLabels = ['Name', 'Tshirt Size', 'Dietary Restrictions'];
    for(let k in userDataLabels){
      const descriptorBar = document.createElement('div');
      descriptorBar.classList.add('bar');
      const labelDiv = document.createElement('div');
      labelDiv.classList.add('title');
      labelDiv.innerText = userDataLabels[k];
      const dataDiv = document.createElement('div');
      dataDiv.classList.add('description');
      dataDiv.innerText = userData[k];
      descriptorBar.append(labelDiv, dataDiv);
      div.append(descriptorBar);
    }

    document.body.append(div);

    await sleep(500); // wait for the first popup to leave, and also stagger after initial interaction for sfx to finish
    Sounds['popup']?.play();
    div.style.transform = 'translateY(0)';
    div.style.animationName = 'flickerIn';
    div.style.animationDelay = '0.1s';
    for(const [eventId, eventCheckins] of Object.entries(data.a || {})){
      const counterElement = document.getElementById(`ct-${eventId}`);
      if(counterElement.innerText != eventCheckins) replayAnimation(counterElement);
      counterElement.innerText = eventCheckins;
    }
  }
}
function updateReaderData(data){
  const div = document.querySelector("#readerData");
  if(!readerData !== !data){
    replayAnimation(div);
    div.style.animationDelay = '0s';
  }
  if(readerData !== data && data){ // different data?
    Sounds['cardScan']?.play();
    console.log("NEW CARD!", data, registeredEvent);
    get(child(ref(database), `cards/${data}/e`)).then(async snapshot => {
      const owner = snapshot.val();
      if(registeredEvent){
        push(child(ref(database), `re`), {
          t: serverTimestamp(),
          c: owner,
          e: registeredEvent, // event id
        });
        // const visits = (await get(child(ref(database), `data/${owner.replaceAll('.','@')}/a/${registeredEvent}`))).val();
        // console.log(visits);
        // set(child(ref(database), `data/${owner.replaceAll('.','@')}/a/${registeredEvent}`), 1 + 
        //   (visits || 0)
        // );
        // race conditions are gone :sunglasses:
        set(child(ref(database), `data/${owner.replaceAll('.','@')}/a/${registeredEvent}`), increment(1));
        set(child(ref(database), `events/${registeredEvent}/c`), increment(1));
      }
      const userdata = (await get(child(ref(database), `data/${owner.replaceAll('.','@')}`))).val();
      updateCardResult(userdata);
      // updateFeedback("CARD DATA\n" + Object.entries(userdata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'));
    });
  }
  div.style.background = data ? "darkgreen" : "darkred";
  div.innerText = data ? "Card OK" : "no card scanned";
  readerData = data;
  updateLinkStatus();
  if(!data) updateCardResult();
}
function updateLinkStatus(){
  const button = document.querySelector('#linkCards');
  if(!(readerData && peripheralData)) button.classList.add('disabled');
  else button.classList.remove('disabled');
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
    if(openReaderButton.classList.contains('disabled')) return;
    try {
      const decoder = new TextDecoder();
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });

      openReaderButton.classList.add('disabled'); // openReaderButton.disabled = true;

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
                if(matchResult && matchResult[0]) updateReaderData(matchResult[0]);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        reader.releaseLock();
        port.close();
        console.log(o);
        openReaderButton.classList.remove('disabled'); // openReaderButton.disabled = false;
      }
    }catch(err){
      updateFeedback("failed to open port " + err);
    }
  };

  const linkCardsButton = document.createElement("button");
  linkCardsButton.id = "linkCards";
  linkCardsButton.innerText = "Link to card";
  linkCardsButton.classList.add('disabled', 'customSuccessSfx', 'customFailSfx'); // linkCardsButton.disabled = true;
  linkCardsButton.addEventListener('click', async () => {
    if(linkCardsButton.classList.contains('disabled')) return Sounds['button-onclick-disabled'].play();

    console.log("DATAS", peripheralData, readerData);

    // TODO : handle reassigning an already assigned card
    update(child(ref(database), `cards/${readerData}`), { e: peripheralData.email });
    update(child(ref(database), `data/${peripheralData.emailAsKey}`), { card: readerData });
    Sounds['linkCard']?.play();

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
    peerReconnect.onclick = async () => {
      await sleep(10);
      if(peerReconnect.classList.contains('disabled')) return;
      qrcodeDisplay(`${window.location.origin}/?peer=${encodeURIComponent(id)}`);
      peerReconnect.classList.add('disabled');
    };
    peer.on("connection", (connection) => {
      // console.log(qrcode);
      qrcodeDisplay();
      peerReconnect.classList.remove('disabled');
      // Receive messages
      connection.on("data", async (data) => {
        console.log("Received", data);
        connection.send("ok");
        connection.close();
        
        const [uid, time] = data.split(','); // what client claims
        let validQrCode = false;
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
          validQrCode = true;
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
        if(validQrCode) Sounds['phoneScanPass']?.play();
        else Sounds['phoneScanFail']?.play();
      });
      // connection.on("open", () => console.log(" >!!", connection.peer));
      // connection.on("close", () => console.log("<--<", connection.peer));
      // console.log(" >>>", connection.peer);
    });
  });

  const newEventButton = document.createElement('button');
  newEventButton.innerText = "+ Event";
  // newEventButton.style.position = 'absolute';
  newEventButton.addEventListener('click', async () => {
    await sleep(10);
    const payload = prompt("Name of new event? (at least 5 characters)");
    if(payload?.length >= 5){
      push(child(ref(database), `events`), {
        n: payload,
        d: "placeholder description (click to edit)",
      });
    }
  });

  const newParticipantButton = document.createElement('button');
  newParticipantButton.innerText = "+ Person";
  newParticipantButton.addEventListener('click', async () => {
    await sleep(10);
    const prompts = [
      "Enter the email of the participant",
      "Enter the name of the participant",
      "Enter participants dietary restictions (enter 'None' if there are none)",
      "Enter participants shirt size (S, M, L, XL)",
    ];
    const promptLabels = ["Email", "Name", "Dietary Restrictions", "Shirt Size"];
    const promptResponses = [];
    for(const promptString of prompts){
      const response = prompt(promptString);
      if(!response) return;
      promptResponses.push(response);
    }
    if(!confirm(`Confirmation\n${promptLabels.map((label, i) => `${label}: ${promptResponses[i]}`).join('\n')}`)) return;
    const [email, name, diet, shirtSize] = promptResponses;
    const userObject = {
      "e": email,
      "pii": JSON.stringify([name, diet, shirtSize]),
    };
    await update(child(ref(database), `data/${email.replaceAll('.', '@')}`), userObject);
    updatePeripheralData({
      email: email,
      emailAsKey: email.replaceAll('.','@'),
      uid: "impromptu"+Date.now()+"::"+Math.random().toString().slice(2),
      user: userObject,
    })
  });

  const eventContainer = document.createElement('div');
  eventContainer.classList.add('eventContainer');
  onChildAdded(child(ref(database), `events`), (snapshot) => {
    const id = snapshot.key;
    const snapshotValue = snapshot.val();
    let [name, description] = ["n", "d"].map(k => snapshotValue[k]);
    const eventBar = document.createElement('div');
    eventBar.classList.add('event');

    const globalCounterDiv = document.createElement('div');
    // globalCounterDiv.id = `gct-${id}`;
    globalCounterDiv.classList.add('counter', 'globalCounter');
    onValue(child(ref(database), `events/${id}/c`), snapshot => {
      replayAnimation(globalCounterDiv);
      globalCounterDiv.innerText = `${snapshot.val() || 0}`;
    }, console.error);

    const counterDiv = document.createElement('div');
    counterDiv.id = `ct-${id}`;
    counterDiv.classList.add('counter');
    counterDiv.innerText = "0";

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('title', 'customSuccessSfx');
    onValue(child(ref(database), `events/${id}/n`), snapshot => nameDiv.innerText = `${name=snapshot.val()}`, console.error);
    nameDiv.onclick = async () => {
      Sounds['changeDesc']?.play();
      await sleep(10); // wait for sound to start playing first
      const payload = prompt(`Enter a new name for event ${name}`);
      if(payload) update(child(ref(database), `events/${id}/n`), payload);
    };

    const descriptionDiv = document.createElement('div');
    descriptionDiv.classList.add('description', 'customSuccessSfx');
    onValue(child(ref(database), `events/${id}/d`), snapshot => descriptionDiv.innerText = `${description=snapshot.val()}`, console.error);
    descriptionDiv.onclick = async () => {
      Sounds['changeDesc']?.play();
      await sleep(10); // wait for sound to start playing first
      const payload = prompt(`Enter a new description for event ${name}\nOld description: ${description}`);
      if(payload) update(child(ref(database), `events/${id}/n`), payload);
    };
    const selectEventButton = document.createElement('button');
    selectEventButton.innerText = 'Select';
    selectEventButton.classList.add('customSuccessSfx', 'customFailSfx');
    selectEventButton.addEventListener('click', async () => {
      if(selectEventButton.classList.contains('disabled')) return Sounds['button-onclick-disabled'].play();
      if(registeredEventElement){
        const registeredEventButton = document.querySelector('div.event.selected > button.disabled');
        registeredEventButton.classList.remove('disabled');
        registeredEventElement.classList.remove('selected');
        replayAnimation(registeredEventButton);
      }
      registeredEventElement = eventBar;
      registeredEventElement.classList.add('selected');
      selectEventButton.classList.add('disabled');
      registeredEvent = id;
      Sounds['selectEvent'].play();
      console.log("halp", Sounds['selectEvent']);

      // if you ever select, you dont need to link cards anymore (probably)
      container.classList.add('floatUp');
    });

    eventBar.append(globalCounterDiv, counterDiv, nameDiv, descriptionDiv, selectEventButton);
    eventContainer.append(eventBar);
}, console.error);

  container.append(openReaderButton, peerReconnect, newEventButton, newParticipantButton, peripheralDataStatus, readerDataStatus, linkCardsButton);
  document.body.append(container, eventContainer);

  // for testing
  peripheralDataStatus.onclick = () => updatePeripheralData({
    email: "test@test.test",
    emailAsKey: "test@test.test".replaceAll('.','@'),
    uid: "testaccount",
    user: {
      "e": "test@test.test",
      "pii": `["Test user","XL","None"]`,
    },
  });
  readerDataStatus.onclick = () => updateReaderData("testcardnumber");
  updatePeripheralData();
  updateReaderData();
}