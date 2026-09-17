'use strict';
(() => {
  const KEY = 'neon-terninger-v1';
  const DB_NAME = 'neon-terninger-media-v1';
  const DB_STORE = 'images';
  const $ = id => document.getElementById(id);
  const emptyFace = (text = '') => ({text, imageId: ''});
  const defaults = () => ({version: 2, count: 4, dice: Array.from({length: 4}, (_, i) => ({name: `Terning ${i + 1}`, faces: ['1','2','3','4','5','6'].map(emptyFace)}))});
  const faceOK = f => f && typeof f.text === 'string' && f.text.length <= 160 && typeof f.imageId === 'string' && f.imageId.length <= 100 && (f.text.trim() || f.imageId);
  const valid2 = data => data && data.version === 2 && Number.isInteger(data.count) && data.count >= 1 && data.count <= 4 && Array.isArray(data.dice) && data.dice.length === 4 && data.dice.every(d => typeof d.name === 'string' && d.name.trim() && d.name.length <= 30 && Array.isArray(d.faces) && d.faces.length >= 2 && d.faces.length <= 20 && d.faces.every(faceOK));
  const valid1 = data => data && data.version === 1 && Number.isInteger(data.count) && data.count >= 1 && data.count <= 4 && Array.isArray(data.dice) && data.dice.length === 4 && data.dice.every(d => typeof d.name === 'string' && d.name.trim() && Array.isArray(d.faces) && d.faces.length >= 2 && d.faces.length <= 20 && d.faces.every(f => typeof f === 'string' && f.trim()));
  const migrate = data => ({version: 2, count: data.count, dice: data.dice.map(d => ({name: d.name, faces: d.faces.map(text => emptyFace(text))}))});

  let config = defaults();
  let storageOK = true;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (valid2(parsed)) config = parsed;
      else if (valid1(parsed)) config = migrate(parsed);
    }
  } catch { storageOK = false; }

  const media = (() => {
    let dbPromise;
    const open = () => {
      if (!('indexedDB' in window)) return Promise.reject(new Error('Billedlager understøttes ikke i denne browser.'));
      if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Kunne ikke åbne billedlageret.'));
      });
      return dbPromise;
    };
    const action = async (mode, run) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode); const store = tx.objectStore(DB_STORE); let request;
        try { request = run(store); } catch (error) { reject(error); return; }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Billedlageret svarede ikke.'));
      });
    };
    return {
      get: id => action('readonly', store => store.get(id)),
      put: (id, blob) => action('readwrite', store => store.put(blob, id)),
      del: id => action('readwrite', store => store.delete(id)),
      keys: () => action('readonly', store => store.getAllKeys())
    };
  })();

  const imageURLs = new Map();
  const imagePromises = new Map();
  async function imageURL(id) {
    if (!id) return '';
    if (imageURLs.has(id)) return imageURLs.get(id);
    if (imagePromises.has(id)) return imagePromises.get(id);
    const pending=(async()=>{try { const blob=await media.get(id); if(!blob)return ''; const url=URL.createObjectURL(blob); imageURLs.set(id,url); return url; }catch{return '';}finally{imagePromises.delete(id);}})(); imagePromises.set(id,pending); return pending;
  }
  function dropCachedURL(id) { if (imageURLs.has(id)) { URL.revokeObjectURL(imageURLs.get(id)); imageURLs.delete(id); } }
  async function deleteImage(id) { if (!id) return; try { await media.del(id); } catch {} dropCachedURL(id); }
  async function cleanupUnusedImages() {
    const used = new Set(config.dice.flatMap(d => d.faces.map(f => f.imageId).filter(Boolean)));
    try { const backup=JSON.parse(localStorage.getItem('neon-terninger-custom-backup-v1')||'null'); for(const d of backup?.dice||[]) for(const f of d.faces||[]) if(f.imageId) used.add(f.imageId); } catch {}
    try { for (const id of await media.keys()) if (!used.has(id)) await deleteImage(id); } catch {}
  }
  async function prepareImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Vælg en almindelig billedfil.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Billedet er for stort. Maks. 20 MB før optimering.');
    const source = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Billedet kunne ikke læses.')); img.src = source; });
      const max = 1200; const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d', {alpha: false}); ctx.fillStyle = '#140a12'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
      if (!blob) throw new Error('Billedet kunne ikke optimeres.');
      return blob;
    } finally { URL.revokeObjectURL(source); }
  }

  let selected = 0, next = 0, round = 1, busy = false, results = [null,null,null,null], resultIndices = [null,null,null,null];
  let imageBusy = false;
  let draft, editing = 0, sessionNewImages = new Set(), facePaint = 0;
  const announce = text => { $('announcement').textContent = text; };
  const element = (tag, className, content) => { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = content; return el; };
  const faceLabel = face => face?.text?.trim() || (face?.imageId ? 'Billedside' : 'Tom side');
  const boardUI = window.NeonBoards.create({onChange:render, onSelect:selectDie, faceLabel, imageURL});
  function save() { try { localStorage.setItem(KEY, JSON.stringify(config)); storageOK = true; } catch { storageOK = false; announce('Ændringerne virker nu, men browseren kunne ikke gemme dem.'); } updateStorage(); }
  function updateStorage() { $('storage-label').textContent = storageOK ? 'Tekst + billeder gemt lokalt' : 'Kun gemt indtil siden lukkes'; }
  function resetRound(increment = true) { if (busy) return; if (increment) round++; selected = 0; next = 0; results = [null,null,null,null]; resultIndices = [null,null,null,null]; render(); }
  function setCount(count) { if (busy || !Number.isInteger(count) || count < 1 || count > 4) return; config.count = count; save(); resetRound(false); $('dice-count').children[count - 1].focus(); }
  function selectDie(index, source = 'list') { if (busy || index < 0 || index >= config.count) return; selected = index; next = index; render(); if (source === 'reel') document.querySelector(`[data-reel="${index}"]`)?.focus(); else $('dice-list').children[index].focus(); }

  async function addFaceImage(container, imageId, className, alt) {
    const token = container.dataset.paint || '';
    const url = await imageURL(imageId);
    if (!url || (container.dataset.paint || '') !== token) return;
    const img = element('img', className); img.src = url; img.alt = alt; container.prepend(img);
  }
  function faceView(faceData) {
    const face = $('die-face'); const paint = String(++facePaint); face.dataset.paint = paint; face.replaceChildren(); face.classList.remove('long-face','has-image');
    if (faceData === null) { face.append(element('span','question-mark','?')); return; }
    const text = faceData.text.trim(); const patterns = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
    if (faceData.imageId) { face.classList.add('has-image'); void addFaceImage(face, faceData.imageId, 'die-image', text || 'Billede på terningeside'); }
    if (!faceData.imageId && Object.hasOwn(patterns, text)) {
      const pips = element('div','die-pips'); pips.setAttribute('aria-label', text);
      for (let i=0;i<9;i++) { const dot = element('span', patterns[text].includes(i) ? 'pip' : ''); dot.setAttribute('aria-hidden','true'); pips.append(dot); }
      face.append(pips); return;
    }
    if (text) { const label = element('span', faceData.imageId ? 'face-overlay' : 'face-text', text); if (text.length > 38) face.classList.add('long-face'); face.append(label); }
  }
  function appendResultContent(card, face) {
    const content = element('div','result-content');
    if (face?.imageId) { content.dataset.paint = String(facePaint); void addFaceImage(content, face.imageId, 'result-thumb', face.text || 'Resultatbillede'); }
    content.append(element('strong','',face ? faceLabel(face) : '—')); card.append(content);
  }

  function render() {
    const countButtons = $('dice-count'); countButtons.replaceChildren();
    for (let i=1;i<=4;i++) { const button = element('button','',String(i)); button.type='button'; button.setAttribute('aria-label',`${i} ${i===1?'terning':'terninger'}`); button.setAttribute('aria-pressed',String(config.count===i)); button.disabled=busy; button.addEventListener('click',()=>setCount(i)); countButtons.append(button); }
    const list = $('dice-list'); list.replaceChildren();
    config.dice.slice(0,config.count).forEach((die,i) => { const button=element('button','dice-card'); button.setAttribute('aria-pressed',String(selected===i)); button.setAttribute('aria-label',`Vælg ${die.name}`); button.disabled=busy; button.append(element('span','die-number',`0${i+1}`)); const label=element('span','dice-card-text'); const imageCount=die.faces.filter(f=>f.imageId).length; label.append(element('strong','',die.name),element('small','',`${die.faces.length} sider${imageCount?` · ${imageCount} med billede`:''}${results[i]!==null?' · Kastet':''}`)); button.append(label,element('span','card-status',selected===i?'↗':results[i]!==null?'✓':'')); button.addEventListener('click',()=>selectDie(i)); list.append(button); });
    $('round-label').textContent=`RUNDE ${String(round).padStart(2,'0')}`; $('active-name').textContent=config.dice[selected].name; faceView(results[selected]);
    $('result-caption').textContent=results[selected]===null?'KLAR TIL ET SLAG':'DIT RESULTAT'; $('result-value').textContent=results[selected]===null?'Hvad mon det bliver?':faceLabel(results[selected]);
    const complete=results.slice(0,config.count).every(r=>r!==null); $('roll-label').textContent=busy?'Terningen ruller…':`Slå ${results[next]!==null?'igen med':'med'} ${config.dice[next].name}`;
    ['roll-button','new-round','edit-button'].forEach(id=>$(id).disabled=busy); $('roll-hint').textContent=complete?'Alle terninger er kastet. Frist skæbnen igen, eller start en ny runde.':'Én terning ad gangen. Resten er op til jer.'; $('progress-label').textContent=`${results.slice(0,config.count).filter(r=>r!==null).length} af ${config.count} kastet`;
    const summaries=$('results-list'); summaries.replaceChildren(); summaries.style.setProperty('--count',config.count);
    config.dice.slice(0,config.count).forEach((die,i)=>{ const card=element('div',`result-card${results[i]!==null?' has-result':''}`); card.append(element('small','',die.name)); appendResultContent(card,results[i]); summaries.append(card); }); updateStorage();
    document.querySelectorAll('#open-mode, .pack-launcher').forEach(button => { button.disabled = busy; });
    boardUI.render({config, selected, next, busy, results, resultIndices});
  }

  function randomIndex(length) { const limit=Math.floor(4294967296/length)*length; const data=new Uint32Array(1); do { crypto.getRandomValues(data); } while(data[0]>=limit); return data[0]%length; }
  async function roll(index=next) {
    if (busy) throw new Error('Et slag er allerede i gang.');
    if (document.querySelector('dialog[open]')) throw new Error('Luk den åbne dialog først.');
    if (!Number.isInteger(index)||index<0||index>=config.count) throw new Error('Vælg en aktiv terning.');
    const die=config.dice[index], outcome=randomIndex(die.faces.length);
    busy=true; selected=index; render();
    $('result-caption').textContent='SPÆNDINGEN STIGER';
    $('result-value').textContent=boardUI.mode==='dice'?'Terningen ruller…':'Hjulet ruller…';
    try {
      await boardUI.spin(index,outcome,faceView);
      results[index]=die.faces[outcome]; resultIndices[index]=outcome; next=index;
      for(let offset=1;offset<=config.count;offset++){const candidate=(index+offset)%config.count;if(results[candidate]===null){next=candidate;break;}}
    } finally { busy=false; render(); }
    boardUI.reveal();
    announce(die.name+': '+faceLabel(results[index])+'. '+results.slice(0,config.count).filter(Boolean).length+' af '+config.count+' færdige.');
    return {die:die.name,board:boardUI.mode,faceIndex:outcome,result:{text:results[index].text,hasImage:Boolean(results[index].imageId)}};
  }

  function openEditor(){ if(busy)return; draft=JSON.parse(JSON.stringify(config.dice)); editing=selected; sessionNewImages=new Set(); $('editor-error').textContent=''; renderEditor(); $('editor').showModal(); }
  async function paintEditorPreview(preview, face) { preview.dataset.paint=face.imageId; if(!face.imageId){preview.append(element('span','preview-empty','Intet billede'));return;} const url=await imageURL(face.imageId); if(preview.dataset.paint!==face.imageId)return; if(!url){preview.append(element('span','preview-empty','Billede mangler'));return;} const img=element('img','editor-preview-image'); img.src=url; img.alt=face.text||'Forhåndsvisning'; preview.append(img); }
  function renderEditor(){
    const tabs=$('editor-tabs'); tabs.replaceChildren(); draft.forEach((die,i)=>{const button=element('button','',`Terning ${i+1}`);button.type='button';button.setAttribute('aria-pressed',String(i===editing));button.addEventListener('click',()=>{editing=i;renderEditor();$('editor-tabs').children[i].focus();});tabs.append(button);}); $('die-name').value=draft[editing].name;
    const container=$('face-inputs'); container.replaceChildren();
    draft[editing].faces.forEach((face,i)=>{
      const card=element('section','face-editor-card'); const top=element('div','face-editor-top'); top.append(element('span','face-index',`SIDE ${String(i+1).padStart(2,'0')}`)); const remove=element('button','remove-face','×'); remove.type='button'; remove.setAttribute('aria-label',`Fjern side ${i+1}`); remove.disabled=draft[editing].faces.length<=2; remove.addEventListener('click',async()=>{const id=draft[editing].faces[i].imageId;if(sessionNewImages.has(id)){sessionNewImages.delete(id);await deleteImage(id);}draft[editing].faces.splice(i,1);renderEditor();}); top.append(remove);
      const grid=element('div','face-editor-grid'); const preview=element('div','face-preview'); void paintEditorPreview(preview,face);
      const fields=element('div','face-fields'); const textLabel=element('label','mini-label','Tekst'); textLabel.htmlFor=`face-${i}`; const input=element('input'); input.id=`face-${i}`; input.value=face.text; input.maxLength=160; input.placeholder='Fx Kys mig, Massage, 6…'; input.addEventListener('input',()=>{draft[editing].faces[i].text=input.value;});
      const actions=element('div','image-actions'); const uploadLabel=element('label','upload-button',face.imageId?'Skift billede':'Tilføj billede'); const file=element('input','file-input'); file.type='file'; file.accept='image/*'; file.setAttribute('aria-label',`Vælg billede til side ${i+1}`); uploadLabel.append(file);
      file.addEventListener('change',async()=>{const chosen=file.files?.[0];if(!chosen||imageBusy)return; const targetFace=face; imageBusy=true; $('editor-form').querySelectorAll('button,input').forEach(control=>control.disabled=true); $('editor-error').textContent='Optimerer billedet…'; try{const blob=await prepareImage(chosen);const id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;await media.put(id,blob);sessionNewImages.add(id);const old=targetFace.imageId;if(sessionNewImages.has(old)&&old!==id){sessionNewImages.delete(old);await deleteImage(old);}targetFace.imageId=id;$('editor-error').textContent='';renderEditor();}catch(error){$('editor-error').textContent=error.message||'Billedet kunne ikke tilføjes.';}finally{imageBusy=false;$('editor-form').querySelectorAll('button,input').forEach(control=>control.disabled=false);renderEditor();}});
      actions.append(uploadLabel); if(face.imageId){const clear=element('button','clear-image','Fjern billede');clear.type='button';clear.addEventListener('click',async()=>{const id=draft[editing].faces[i].imageId;if(sessionNewImages.has(id)){sessionNewImages.delete(id);await deleteImage(id);}draft[editing].faces[i].imageId='';renderEditor();});actions.append(clear);}
      fields.append(textLabel,input,actions); grid.append(preview,fields); card.append(top,grid); container.append(card);
    }); $('face-count').textContent=`(${draft[editing].faces.length})`; $('add-face').disabled=draft[editing].faces.length>=20;
  }
  $('die-name').addEventListener('input',()=>{draft[editing].name=$('die-name').value;});
  $('add-face').addEventListener('click',()=>{if(draft[editing].faces.length>=20)return;draft[editing].faces.push(emptyFace(''));renderEditor();$('face-inputs').lastElementChild.querySelector('input:not([type=file])').focus();});
  async function cancelEditor(){if(imageBusy){$('editor-error').textContent='Vent, mens billedet gemmes…';return;}for(const id of sessionNewImages)await deleteImage(id);sessionNewImages.clear();$('editor').close();}
  $('editor-form').addEventListener('submit',async event=>{event.preventDefault(); if(imageBusy){$('editor-error').textContent='Vent, mens billedet gemmes…';return;} const normalized=draft.map(d=>({name:d.name.trim(),faces:d.faces.map(f=>({text:f.text.trim(),imageId:f.imageId||''}))})); const bad=normalized.findIndex(d=>!d.name||d.faces.some(f=>!f.text&&!f.imageId)); if(bad!==-1){editing=bad;renderEditor();$('editor-error').textContent=`Udfyld tekst eller tilføj et billede på alle sider af terning ${bad+1}.`;return;} config={...config,version:2,dice:normalized};sessionNewImages.clear();save();$('editor').close();resetRound(false);void cleanupUnusedImages();announce(storageOK?'Dine terninger er gemt. Klar til en ny runde.':'Terningerne er ændret, men teksten kunne ikke gemmes på enheden.');});
  $('close-editor').addEventListener('click',()=>void cancelEditor()); $('cancel-editor').addEventListener('click',()=>void cancelEditor()); $('editor').addEventListener('cancel',event=>{event.preventDefault();void cancelEditor();});
  $('edit-button').addEventListener('click',openEditor); $('roll-button').addEventListener('click',()=>{if(!busy)void roll().catch(error=>announce(error.message||'Slaget kunne ikke gennemføres. Prøv igen.'));}); $('new-round').addEventListener('click',()=>{resetRound();announce('Ny runde. Dine terninger er klar.');}); $('help-button').addEventListener('click',()=>$('help').showModal()); $('close-help').addEventListener('click',()=>$('help').close());
  if (config.version === 2) save(); render(); void cleanupUnusedImages();
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(document.modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};register({name:'read_dice_game',description:'Read active dice, text/image face metadata and current round results.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({board:boardUI.mode,faceIndices:resultIndices.slice(0,config.count),count:config.count,dice:config.dice.slice(0,config.count).map(d=>({name:d.name,faces:d.faces.map(f=>({text:f.text,hasImage:Boolean(f.imageId)}))})),results:results.slice(0,config.count).map(r=>r?{text:r.text,hasImage:Boolean(r.imageId)}:null),round,busy})});register({name:'roll_one_die',description:'Roll one active die (1–4). Waits for the result.',inputSchema:{type:'object',properties:{die:{type:'integer',minimum:1,maximum:4}},required:['die'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||!Number.isInteger(input.die))throw new Error('die must be an integer');if($('editor').open||$('help').open)throw new Error('Close the open dialog first.');return roll(input.die-1);}});register({name:'select_game_board',description:'Choose dice, slot or wheel. Preserves sides and round results. Fails while spinning or when a dialog is open.',inputSchema:{type:'object',properties:{board:{type:'string',enum:['dice','slot','wheel']}},required:['board'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{boardUI.setMode(input?.board);return {board:boardUI.mode};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
})();
