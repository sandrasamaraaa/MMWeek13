import { firebaseConfig, SESSION_ID, GAME_DURATION_SECONDS } from './config.js';

const IS_PRESENTER = document.body.dataset.role === 'presenter';
const WORDS = [
  { id: 'MANGOSTEEN', row: 7, col: 0, direction: 'across', clue: 'Purple outside, white inside. They call me the queen of tropical fruits.', asset: 'mangosteen' },
  { id: 'GUAVA', row: 3, col: 1, direction: 'down', clue: 'Green outside, pink or white inside. Often enjoyed as juice.', asset: 'guava' },
  { id: 'TURMERIC', row: 4, col: 0, direction: 'across', clue: 'I am in jamu, and my yellow-orange color can stain almost anything.', asset: 'turmeric' },
  { id: 'SUGARCANE', row: 0, col: 9, direction: 'down', clue: 'I make drinks sweet, but my fibers can also be used in packaging.', asset: 'sugarcane' },
  { id: 'BLACKTEA', row: 1, col: 7, direction: 'down', clue: 'A darker version of a popular drink brewed from leaves. Just add hot water.', asset: 'black-tea' }
];
const ROWS = 9, COLS = 10;
const $ = id => document.getElementById(id);
const seconds = Number(GAME_DURATION_SECONDS) || 180;
const configured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE_') && firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_PROJECT_ID');
const demoKey = `fti-island-demo-${SESSION_ID}`;
const makeRound = () => 'round-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const newSession = () => ({ roundId: makeRound(), status: 'waiting', startedAt: null, durationSec: seconds, claims: {} });
const normalize = word => String(word || '').toUpperCase().replace(/[^A-Z]/g, '');
let session = newSession(), selected = 'SUGARCANE', authUser = null;
let joined = false, nickname = '', online = configured, presenterAuthorized = !configured;
let db = null, firebaseApi = null, sessionRef = null, claimsUnsubscribe = null;
let toastTimer, sessionExists = false, unsubSession = null;

const grid = new Map();
for (const word of WORDS) {
  for (let i = 0; i < word.id.length; i++) {
    const r = word.row + (word.direction === 'down' ? i : 0);
    const c = word.col + (word.direction === 'across' ? i : 0);
    const key = `${r},${c}`;
    if (!grid.has(key)) grid.set(key, { char: word.id[i], r, c, words: [word.id] });
    else {
      const cell = grid.get(key);
      if (cell.char !== word.id[i]) throw Error(`Invalid crossword collision at ${key}`);
      cell.words.push(word.id);
    }
  }
}
const startPositions = [...new Set(WORDS.map(w => `${w.row},${w.col}`))].sort((a,b)=> {
  const [r,c]=a.split(',').map(Number), [rr,cc]=b.split(',').map(Number);
  return (r-rr) || (c-cc);
});
for (const word of WORDS) word.number = startPositions.indexOf(`${word.row},${word.col}`) + 1;
const startNumber = new Map(startPositions.map((x,i)=>[x,i+1]));

function getDemoState() {
  try { const saved = JSON.parse(localStorage.getItem(demoKey)); if (saved && saved.roundId) return saved; } catch(e) {}
  return newSession();
}
function updateDemo(next) {
  session = next;
  try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch(e) {}
  render();
}
function toast(message) {
  const el = $('toast'); if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 3300);
}
function timeLeft() {
  if (session.status === 'waiting' || !session.startedAt) return (session.durationSec || seconds) * 1000;
  if (session.status === 'finished') return 0;
  return Math.max(0, session.startedAt + (session.durationSec || seconds) * 1000 - Date.now());
}
function mmss(ms){ const s=Math.max(0,Math.ceil(ms/1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function isFinished(){return session.status==='finished' || Object.keys(session.claims).length===WORDS.length || (session.status==='live' && timeLeft()<=0);}
function gameOpen(){return session.status==='live' && !isFinished();}
function claimed(wordId){return Boolean(session.claims[wordId]);}
function safeName(name){return String(name||'Explorer').slice(0,20).replace(/[<>\u0000-\u001f]/g,'').trim() || 'Explorer';}
function earliest(claim){if (typeof claim.claimedAt === 'number') return claim.claimedAt; return Infinity;}
function rankings() {
  const map = new Map();
  for (const w of WORDS) {
    const c=session.claims[w.id];
    if(!c || c.source==='presenter') continue;
    const key=c.uid;
    if(!map.has(key)) map.set(key,{uid:key,name:safeName(c.nickname),points:0,first:Infinity});
    const v=map.get(key);v.points++;v.first=Math.min(v.first, earliest(c));
  }
  return [...map.values()].sort((a,b)=>b.points-a.points || a.first-b.first || a.name.localeCompare(b.name));
}
function renderBoard(){
  const holder=$('crossword');if(!holder)return;
  const frag=document.createDocumentFragment();
  for(let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++){
    const key=`${row},${col}`, data=grid.get(key);
    const cell=document.createElement('div');cell.className='cell';
    if(!data){cell.classList.add('empty');cell.setAttribute('aria-hidden','true');frag.appendChild(cell);continue;}
    const solved=data.words.some(claimed),highlight=!IS_PRESENTER && !claimed(selected) && data.words.includes(selected);
    if(solved)cell.classList.add('solved');
    if(solved && data.words.length>1)cell.classList.add('crossing');
    if(highlight)cell.classList.add('selected');
    if(startNumber.has(key)){
      const number=document.createElement('span');number.className='number';number.textContent=startNumber.get(key);cell.appendChild(number);
    }
    const letter=document.createElement('span');letter.className='letter';letter.textContent=solved?data.char:'';cell.appendChild(letter);
    cell.setAttribute('aria-label',solved?data.char:'blank');
    frag.appendChild(cell);
  }
  holder.replaceChildren(frag);
}
function renderClues(){
  const holder=$('clues');if(!holder)return;
  const frag=document.createDocumentFragment();
  for(const word of [...WORDS].sort((a,b)=>a.number-b.number)){
    const c=session.claims[word.id];
    const button=document.createElement(IS_PRESENTER?'div':'button');
    button.className='clue-button'+(c?' claimed':'')+(!IS_PRESENTER&&word.id===selected&&!c?' selected':'');
    if(!IS_PRESENTER){button.type='button';button.disabled=Boolean(c)||!joined;button.addEventListener('click',()=>{selected=word.id;renderClues();renderBoard();updateInput();});}
    const bubble=document.createElement('span');bubble.className='clue-number';bubble.textContent=word.number;
    const body=document.createElement('span');body.className='clue-body';
    const headline=document.createElement('span');headline.className='clue-title';headline.textContent=`${word.direction==='down'?'↓':'→'} ${word.id.length} letters`;
    const desc=document.createElement('span');desc.className='clue-desc';desc.textContent=word.clue;
    body.append(headline,desc);
    if(c){const status=document.createElement('span');status.className='clue-status';status.textContent=c.source==='presenter'?'Filled by presenter':`Claimed by ${safeName(c.nickname)}`;body.appendChild(status);}
    button.append(bubble,body);
    if(IS_PRESENTER && !c){
      const fill=document.createElement('button');fill.type='button';fill.className='button small';fill.textContent='Fill';
      fill.disabled=!presenterAuthorized||!gameOpen();
      fill.title=`Presenter: reveal ${word.id}`;
      fill.addEventListener('click',()=>fillWord(word.id));button.appendChild(fill);
    }
    frag.appendChild(button);
  }
  holder.replaceChildren(frag);
}
function updateInput(){
  const word=WORDS.find(w=>w.id===selected);
  if($('selected-label')) $('selected-label').textContent=word?`· ${word.id.length} letters`:'';
  if($('answer')){$('answer').disabled=!joined||!gameOpen()||!word||claimed(selected);$('answer').placeholder=word?`${word.id.length}-letter ingredient`:'All clues claimed';}
  if($('submit-answer'))$('submit-answer').disabled=!joined||!gameOpen()||!word||claimed(selected);
}
function renderPlayer(){
  if(!joined) return;
  $('player-label').textContent=nickname;
  $('progress-label').textContent=`${Object.keys(session.claims).length} / 5`;
  $('score-label').textContent=String(WORDS.filter(w=>session.claims[w.id]?.uid===authUser?.uid && session.claims[w.id]?.source==='player').length);
  $('round-label').textContent=`${session.roundId.split('-').slice(-1)[0]||'1'}`;
  const msg=$('round-message');msg.className='notice';
  if(!sessionExists && online)msg.textContent='The presenter has not initialized this session yet.';
  else if(session.status==='waiting')msg.textContent='You are in! The crossword opens when the presenter starts the round.';
  else if(isFinished()) {msg.textContent=Object.keys(session.claims).length===5?'All five ingredients have been discovered.':'The round has ended. Thanks for playing!';msg.classList.add('good');}
  else {msg.textContent='The crossword is live. Choose a clue, submit the whole ingredient, and claim it before anyone else.';msg.classList.add('good');}
  $('finished-panel').hidden=!isFinished();
  if(isFinished()){$('final-summary').textContent=`You claimed ${$('score-label').textContent} of the five ingredients. ${Object.keys(session.claims).length} of 5 words were filled.`;}
  if(claimed(selected)){const next=WORDS.find(w=>!claimed(w.id)); if(next)selected=next.id;}
  renderClues();updateInput();
}
function renderPresenter(){
  $('progress-label').textContent=`${Object.keys(session.claims).length} / 5`;
  const roundStatus=session.status==='waiting'?'WAITING':isFinished()?'FINISHED':'LIVE';
  $('round-label').textContent=roundStatus;
  $('live-pill').textContent=roundStatus;
  $('live-pill').classList.toggle('live',roundStatus==='LIVE');
  $('init-button').hidden=sessionExists;
  $('init-button').disabled=!presenterAuthorized;
  $('start-button').disabled=!presenterAuthorized||!sessionExists||session.status!=='waiting';
  $('end-button').disabled=!presenterAuthorized||!sessionExists||session.status!=='live';
  $('reset-button').disabled=!presenterAuthorized||!sessionExists;
  const board=$('leaderboard');board.replaceChildren();const list=rankings();
  if(!list.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='Scores appear as players claim words.';board.appendChild(empty);}
  else list.forEach((person,i)=>{
    const row=document.createElement('div');row.className='rankrow';
    const r=document.createElement('span');r.className='rank';r.textContent=String(i+1).padStart(2,'0');
    const name=document.createElement('strong');name.textContent=person.name;
    const pts=document.createElement('span');pts.className='points';pts.textContent=`${person.points} ${person.points===1?'point':'points'}`;
    row.append(r,name,pts);board.appendChild(row);
  });
  renderClues();
}
function renderTime(){
  const label=$('time-label');if(!label)return;
  const left=timeLeft();label.textContent=mmss(left);
  label.classList.toggle('urgent',session.status==='live'&&left<30000);
  if(!IS_PRESENTER && joined){updateInput(); if(session.status==='live'&&left===0 && !$('finished-panel').hidden) return;
    if(session.status==='live'&&left===0){render();}}
  if(IS_PRESENTER && session.status==='live' && left===0 && $('round-label').textContent==='LIVE') render();
}
function render(){renderBoard();if(IS_PRESENTER)renderPresenter();else renderPlayer();renderTime();}

async function claimWord(wordId, entered, source){
  if(!gameOpen())throw Error('The round is not accepting answers.');
  const word=WORDS.find(w=>w.id===wordId);if(!word)throw Error('Unknown clue.');
  if(normalize(entered)!==word.id)throw Error('Not quite. Try another answer.');
  if(claimed(wordId))throw Error('Too late! Someone has already claimed that word.');
  const data={answer:word.id,nickname:source==='presenter'?'PRESENTER':safeName(nickname),uid:authUser?.uid||'demo-presenter',source,claimedAt:Date.now()};
  if(!online){
    const fresh=getDemoState();
    if(fresh.roundId!==session.roundId || fresh.status!=='live' || !fresh.startedAt || Date.now()>=fresh.startedAt + fresh.durationSec*1000)throw Error('Round closed.');
    if(fresh.claims[wordId])throw Error('Too late! Someone has claimed that word.');
    fresh.claims[wordId]=data;updateDemo(fresh);return;
  }
  const {doc,runTransaction,serverTimestamp}=firebaseApi.fs;
  const claimRef=doc(db,'sessions',SESSION_ID,'rounds',session.roundId,'claims',wordId);
  await runTransaction(db,async transaction=>{
    const s=await transaction.get(sessionRef);
    const old=await transaction.get(claimRef);
    if(!s.exists()||s.data().roundId!==session.roundId||s.data().status!=='live')throw Error('This round has changed or ended.');
    if(old.exists())throw Error('Too late! Someone has already claimed that word.');
    transaction.set(claimRef,{answer:word.id,nickname:data.nickname,uid:authUser.uid,source,claimedAt:serverTimestamp()});
  });
}
async function fillWord(wordId){
  if(!presenterAuthorized)return toast('Presenter authorization required.');
  if(!confirm(`Fill ${wordId} on every player's crossword? Presenter-filled words do not earn points.`))return;
  try{await claimWord(wordId,wordId,'presenter');toast(`${wordId} filled on the shared board.`);}catch(e){toast(e.message||'Unable to fill word.');}
}
async function writeSession(action){
  if(!presenterAuthorized)return toast('Presenter authorization required: see setup panel.');
  try{
    if(!online){
      const state=getDemoState();
      if(action==='init'||action==='reset'){updateDemo(newSession());}
      else if(action==='start'){if(state.status!=='waiting')return;state.status='live';state.startedAt=Date.now();updateDemo(state);}
      else if(action==='end'){state.status='finished';updateDemo(state);}
      sessionExists=true;toast(`Presenter action: ${action}`);return;
    }
    const {setDoc,updateDoc,serverTimestamp}=firebaseApi.fs;
    if(action==='init'){
      const next=newSession();
      await setDoc(sessionRef,{roundId:next.roundId,status:'waiting',startedAt:null,durationSec:seconds,updatedAt:serverTimestamp()});
    }else if(action==='reset'){
      const next=newSession();
      await updateDoc(sessionRef,{roundId:next.roundId,status:'waiting',startedAt:null,durationSec:seconds,updatedAt:serverTimestamp()});
    }else if(action==='start'){
      await updateDoc(sessionRef,{status:'live',startedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }else if(action==='end'){
      await updateDoc(sessionRef,{status:'finished',updatedAt:serverTimestamp()});
    }
    toast(action==='start'?'Round started.':action==='reset'?'New round prepared.':action==='init'?'Session initialized.':'Round ended.');
  }catch(e){toast(`Firebase rejected action: ${e.message||e}`);}
}
function renderStatus(text, isError=false){const el=$('error-banner');if(!el)return;el.hidden=!text;el.textContent=text||'';el.className='notice '+(isError?'error':'setup');}
function connectDemo(){
  online=false;sessionExists=true;session=getDemoState();authUser={uid:'demo-'+(()=>{try{let u=sessionStorage.getItem('island-demo-uid');if(!u){u=Math.random().toString(36).slice(2);sessionStorage.setItem('island-demo-uid',u);}return u;}catch(e){return Math.random().toString(36).slice(2)}})()};
  presenterAuthorized=true;
  $('mode-tag').textContent='LOCAL DEMO';
  $('mode-tag').classList.remove('live');
  window.addEventListener('storage',e=>{if(e.key===demoKey){session=getDemoState();render();}});
  render();
  if(IS_PRESENTER){renderStatus('Demo mode: tabs in the same browser can share this puzzle. Different devices will NOT synchronize until Firebase is configured.');}
}
function withTimeout(promise, ms, label){
  let t;
  return Promise.race([promise, new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(`${label} timed out after ${ms/1000}s`)),ms);})]).finally(()=>clearTimeout(t));
}
function friendlyFirebaseError(err){
  const code=err&&err.code||'';
  if(code==='auth/configuration-not-found'||code==='auth/operation-not-allowed')return 'Anonymous sign-in is not enabled. Firebase Console > Authentication > Sign-in method > Anonymous > Enable.';
  if(code==='auth/invalid-api-key'||code==='auth/api-key-not-valid.-please-pass-a-valid-api-key.')return 'The apiKey in config.js is wrong. Copy it again from Project settings > Your apps.';
  if(code==='auth/network-request-failed')return 'Network blocked the Firebase sign-in request. Try another Wi-Fi or mobile data.';
  if(code==='auth/requests-from-referer-are-blocked'||code==='auth/unauthorized-domain')return 'This domain is not allowed. Add your github.io domain in Authentication > Settings > Authorized domains (and in the API key restrictions, if any).';
  return (err&&err.message)||String(err);
}
async function connectFirebase(){
  // Dynamic imports allow the visual design to work in local demo mode even without CDN access.
  const version='13.4.0';
  $('mode-tag').textContent='LOADING FIREBASE';
  const [app,auth,fs]=await withTimeout(Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]),15000,'Loading the Firebase library (gstatic.com may be blocked on this network)');
  firebaseApi={app,auth,fs};
  const firebaseApp=app.initializeApp(firebaseConfig);
  const a=auth.getAuth(firebaseApp);
  db=fs.getFirestore(firebaseApp);
  $('mode-tag').textContent='SIGNING IN';
  const response=await withTimeout(auth.signInAnonymously(a),15000,'Anonymous sign-in');
  authUser=response.user;
  // No UID check: whoever opens leaderboard.html controls the game.
  presenterAuthorized=IS_PRESENTER;
  $('mode-tag').textContent='FIREBASE LIVE';$('mode-tag').classList.add('live');
  if(IS_PRESENTER)renderStatus('Connected to Firebase. Press Initialize session (first time only), then Start round.');
  sessionRef=fs.doc(db,'sessions',SESSION_ID);
  unsubSession=fs.onSnapshot(sessionRef,snap=>{
    const oldRound=session.roundId;
    sessionExists=snap.exists();
    if(sessionExists){
      const doc=snap.data({serverTimestamps:'estimate'});
      const startedAt=doc.startedAt && typeof doc.startedAt.toMillis==='function' ? doc.startedAt.toMillis() : null;
      session={roundId:doc.roundId,status:doc.status,startedAt,durationSec:doc.durationSec||seconds,claims:oldRound===doc.roundId?session.claims:{}};
      if(oldRound!==doc.roundId||!claimsUnsubscribe){
        if(claimsUnsubscribe)claimsUnsubscribe();
        claimsUnsubscribe=fs.onSnapshot(fs.collection(db,'sessions',SESSION_ID,'rounds',doc.roundId,'claims'),result=>{
          const claims={};
          for(const item of result.docs){
            const data=item.data({serverTimestamps:'estimate'});
            claims[item.id]={...data,claimedAt:data.claimedAt?.toMillis?.() ?? Infinity};
          }
          session.claims=claims;render();
        },err=>toast(`Claims listener error: ${err.message}`));
      }
    } else session=newSession();
    render();
  },err=>{renderStatus(`Firebase session listener failed: ${err.message}. Check Firestore rules and project configuration.`,true);toast('Firebase connection error.');});
  render();
}
function setupPresenter(){
  const url=new URL('index.html',location.href);
  url.search='';url.hash='';
  const link=$('player-url');link.href=url.href;link.textContent=url.href;
  $('copy-link').addEventListener('click',()=>copyText(url.href));
  $('init-button').addEventListener('click',()=>writeSession('init'));
  $('start-button').addEventListener('click',()=>writeSession('start'));
  $('end-button').addEventListener('click',()=>writeSession('end'));
  $('reset-button').addEventListener('click',()=>{if(confirm('Start a new empty crossword? This will hide the current round scores.'))writeSession('reset');});
  // QR renderer loads separately from a CDN. The player link above always works as fallback.
  const showQr=()=>{
    if(typeof window.QRCode==='function'){
      const box=$('qr-box');box.replaceChildren();
      new window.QRCode(box,{text:url.href,width:150,height:150,colorDark:'#173F35',colorLight:'#FFFFFF',correctLevel:window.QRCode.CorrectLevel.M});
      return true;
    }
    return false;
  };
  if(!showQr()){
    window.addEventListener('load',showQr,{once:true});
  }
}
function copyText(value){if(navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(()=>toast('Copied to clipboard.')).catch(()=>toast('Could not copy automatically.'));else toast('Copy the link or UID from the page.');}
function setupPlayer(){
  const form=$('join-form');
  try{nickname=sessionStorage.getItem('fti-island-nickname')||'';}catch(e){}
  if(nickname){$('nickname').value=nickname;joined=true;$('join-card').hidden=true;$('game-content').hidden=false;}
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const val=safeName($('nickname').value);
    if(val.length<2)return toast('Enter a nickname of at least two characters.');
    nickname=val;joined=true;
    try{sessionStorage.setItem('fti-island-nickname',val);}catch(e){}
    $('join-card').hidden=true;$('game-content').hidden=false;render();
  });
  $('answer-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!joined)return;
    const field=$('answer');const answer=field.value;
    if(!answer.trim())return toast('Type your answer first.');
    const feedback=$('answer-feedback');feedback.className='field-help';
    $('submit-answer').disabled=true;
    try{
      await claimWord(selected,answer,'player');
      feedback.textContent='Correct! Your answer is being added to the shared board.';
      feedback.classList.add('success');field.value='';toast('Correct! You claimed a word.');
    }catch(error){
      feedback.textContent=error.message||'Unable to submit answer.';feedback.classList.add('bad');toast(feedback.textContent);
    }finally{updateInput();}
  });
}
async function boot(){
  if(IS_PRESENTER)setupPresenter();else setupPlayer();
  if(!configured)connectDemo();
  else {
    try{await connectFirebase();}
    catch(err){
      $('mode-tag').textContent='CONNECT ERROR';
      const msg=friendlyFirebaseError(err);
      console.error('Firebase connection failed:',err);
      renderStatus(`Firebase connection failed: ${msg}`,true);
      toast(`Could not connect to Firebase: ${msg}`);
      // Do not silently fall back to demo after a configured Firebase failure.
    }
  }
  setInterval(renderTime,450);
}
boot();
