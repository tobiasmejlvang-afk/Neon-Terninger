'use strict';
(() => {
  const CONFIG_KEY = 'neon-terninger-v1';
  const MODE_KEY = 'neon-terninger-mode-v1';
  const ACTIVE_KEY = 'neon-terninger-active-pack-v1';
  const PACK_DB = 'neon-terninger-packs-v1';
  const PACK_STORE = 'packs';
  const MEDIA_DB = 'neon-terninger-media-v1';
  const MEDIA_STORE = 'images';
  const $ = id => document.getElementById(id);

  const readJSON = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('Lagerfejl')); });
  const openDB = (name, version, upgrade) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Kunne ikke åbne lokalt lager.'));
  });
  const packDB = () => openDB(PACK_DB, 1, db => { if (!db.objectStoreNames.contains(PACK_STORE)) db.createObjectStore(PACK_STORE, {keyPath:'id'}); });
  const mediaDB = () => openDB(MEDIA_DB, 1, db => { if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE); });
  async function storeAction(dbPromise, storeName, mode, fn) {
    const db = await dbPromise; const tx = db.transaction(storeName, mode); const store = tx.objectStore(storeName); return request(fn(store));
  }
  const packs = {
    all: () => storeAction(packDB(), PACK_STORE, 'readonly', s => s.getAll()),
    get: id => storeAction(packDB(), PACK_STORE, 'readonly', s => s.get(id)),
    put: pack => storeAction(packDB(), PACK_STORE, 'readwrite', s => s.put(pack)),
    del: id => storeAction(packDB(), PACK_STORE, 'readwrite', s => s.delete(id))
  };
  const media = {
    get: id => storeAction(mediaDB(), MEDIA_STORE, 'readonly', s => s.get(id)),
    put: (id, blob) => storeAction(mediaDB(), MEDIA_STORE, 'readwrite', s => s.put(blob, id))
  };

  async function snapshotCurrent(name, existingId = '') {
    const config = readJSON(CONFIG_KEY);
    if (!config?.dice || config.version !== 2) throw new Error('Det aktive terningesæt kunne ikke læses.');
    const savedConfig = clone(config); const images = []; const seen = new Set();
    for (const die of savedConfig.dice) for (const face of die.faces) {
      if (!face.imageId || seen.has(face.imageId)) continue;
      seen.add(face.imageId);
      const blob = await media.get(face.imageId).catch(() => null);
      if (blob) images.push({sourceId:face.imageId, blob});
      else { face.imageId = ''; if (!face.text?.trim()) face.text = 'Billede mangler'; }
    }
    const old = existingId ? await packs.get(existingId).catch(() => null) : null;
    const now = Date.now();
    return {id: existingId || uid('pack'), name:name.trim(), createdAt:old?.createdAt || now, updatedAt:now, config:savedConfig, images};
  }

  async function saveCurrent(name, existingId = '') {
    if (!name.trim()) throw new Error('Giv pakken et navn.');
    if (name.trim().length > 40) throw new Error('Navnet må højst være 40 tegn.');
    const pack = await snapshotCurrent(name, existingId); await packs.put(pack); localStorage.setItem(ACTIVE_KEY, pack.id); return pack;
  }

  async function loadPack(id) {
    const pack = await packs.get(id); if (!pack?.config?.dice) throw new Error('Spilpakken kunne ikke læses.');
    const config = clone(pack.config); const imageMap = new Map();
    for (const item of pack.images || []) {
      if (!item?.blob || !item.sourceId) continue;
      const newId = uid('packimg'); await media.put(newId, item.blob); imageMap.set(item.sourceId, newId);
    }
    for (const die of config.dice) for (const face of die.faces) {
      if (face.imageId) {
        const replacement = imageMap.get(face.imageId);
        if (replacement) face.imageId = replacement;
        else { face.imageId = ''; if (!face.text?.trim()) face.text = 'Billede mangler'; }
      }
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(MODE_KEY, JSON.stringify({id:'custom', name:pack.name, appliedAt:Date.now()}));
    localStorage.setItem(ACTIVE_KEY, pack.id); location.reload();
  }

  function fmt(time) { try { return new Intl.DateTimeFormat('da-DK',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(time)); } catch { return ''; } }
  function buildDialog() {
    const dialog = document.createElement('dialog'); dialog.id = 'pack-dialog'; dialog.setAttribute('aria-labelledby','pack-title');
    dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">DIT BIBLIOTEK</span><h2 id="pack-title">Spilpakker</h2></div><button class="icon-button" id="close-packs" aria-label="Luk">×</button></div><p class="muted pack-intro">Gem hele jeres nuværende sæt — tekst, antal terninger og billeder — og skift mellem pakker uden at bygge dem igen.</p><section class="pack-save"><div><label class="field-label" for="pack-name">Navn på ny pakke</label><input id="pack-name" maxlength="40" placeholder="Fx Date Night"></div><button id="save-pack" class="primary-button" type="button">Gem nuværende sæt <span>＋</span></button><div class="pack-suggestions" aria-label="Navneforslag"><button type="button">Date Night</button><button type="button">Weekend</button><button type="button">Hotel</button><button type="button">Vores favoritter</button></div><p id="pack-error" class="form-error" role="alert"></p></section><div class="pack-list-heading"><div><span class="eyebrow">GEMTE PAKKER</span><strong id="pack-count">0 pakker</strong></div><span class="muted">Gemmes kun på denne enhed</span></div><div id="pack-list" class="pack-list"></div>`;
    document.body.append(dialog);
    $('close-packs').onclick = () => dialog.close();
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelectorAll('.pack-suggestions button').forEach(button => button.onclick = () => { $('pack-name').value = button.textContent; $('pack-name').focus(); });
    $('save-pack').onclick = async () => {
      const button = $('save-pack'); const error = $('pack-error'); error.textContent=''; button.disabled=true;
      try { const saved = await saveCurrent($('pack-name').value); $('pack-name').value=''; await renderList(); flash(`“${saved.name}” er gemt.`); }
      catch (e) { error.textContent = e.message || 'Pakken kunne ikke gemmes.'; }
      finally { button.disabled=false; }
    };
    return dialog;
  }

  function flash(text) { const note = document.createElement('div'); note.className='pack-toast'; note.textContent=text; document.body.append(note); requestAnimationFrame(()=>note.classList.add('show')); setTimeout(()=>{note.classList.remove('show');setTimeout(()=>note.remove(),250);},1800); }

  async function renderList() {
    const list = $('pack-list'); if (!list) return; list.replaceChildren();
    const active = localStorage.getItem(ACTIVE_KEY); const all = (await packs.all()).sort((a,b)=>b.updatedAt-a.updatedAt);
    $('pack-count').textContent = `${all.length} ${all.length===1?'pakke':'pakker'}`;
    if (!all.length) { const empty=document.createElement('div'); empty.className='pack-empty'; empty.innerHTML='<span>◇</span><strong>Ingen gemte pakker endnu</strong><p>Tilpas terningerne, giv sættet et navn ovenfor og gem det som jeres første pakke.</p>'; list.append(empty); return; }
    all.forEach(pack => {
      const card=document.createElement('article'); card.className=`pack-card${pack.id===active?' is-active':''}`;
      const imageCount=(pack.images||[]).length; const sideCount=pack.config.dice.slice(0,pack.config.count).reduce((n,d)=>n+d.faces.length,0);
      card.innerHTML=`<div class="pack-card-main"><span class="pack-icon">◇</span><div><div class="pack-name-row"><h3></h3>${pack.id===active?'<span>AKTIV</span>':''}</div><p>${pack.config.count} terninger · ${sideCount} sider${imageCount?` · ${imageCount} billeder`:''}</p><small>Opdateret ${fmt(pack.updatedAt)}</small></div></div><div class="pack-card-actions"><button class="pack-load" type="button">Brug pakke</button><button class="pack-more" type="button" aria-label="Flere handlinger">•••</button></div><div class="pack-secondary" hidden><button data-action="update" type="button">Gem nuværende oveni</button><button data-action="rename" type="button">Omdøb</button><button data-action="delete" class="danger" type="button">Slet</button></div>`;
      card.querySelector('h3').textContent=pack.name;
      card.querySelector('.pack-load').onclick=async e=>{e.currentTarget.disabled=true;try{await loadPack(pack.id);}catch(err){flash(err.message||'Kunne ikke åbne pakken.');e.currentTarget.disabled=false;}};
      const secondary=card.querySelector('.pack-secondary'); card.querySelector('.pack-more').onclick=()=>{secondary.hidden=!secondary.hidden;};
      secondary.querySelector('[data-action="update"]').onclick=async()=>{if(!confirm(`Erstat indholdet i “${pack.name}” med de terninger, der er aktive nu?`))return;try{await saveCurrent(pack.name,pack.id);await renderList();flash('Pakken er opdateret.');}catch(err){flash(err.message||'Kunne ikke opdatere.');}};
      secondary.querySelector('[data-action="rename"]').onclick=async()=>{const name=prompt('Nyt navn på spilpakken:',pack.name);if(name===null)return;const clean=name.trim();if(!clean||clean.length>40){flash('Navnet skal være 1–40 tegn.');return;}pack.name=clean;pack.updatedAt=Date.now();await packs.put(pack);await renderList();};
      secondary.querySelector('[data-action="delete"]').onclick=async()=>{if(!confirm(`Slet “${pack.name}”? Det kan ikke fortrydes.`))return;await packs.del(pack.id);if(active===pack.id)localStorage.removeItem(ACTIVE_KEY);await renderList();flash('Pakken er slettet.');};
      list.append(card);
    });
  }

  if (!('indexedDB' in window)) return;
  const sidebar=document.querySelector('.sidebar'); const anchor=document.querySelector('.mode-launcher') || document.querySelector('.sidebar .intro'); if(!sidebar||!anchor)return;
  const launcher=document.createElement('button'); launcher.type='button'; launcher.className='pack-launcher'; launcher.innerHTML='<span class="pack-launcher-icon">◇</span><span><small>SPILPAKKER</small><strong>Gem & skift sæt</strong></span><span class="pack-arrow">↗</span>';
  anchor.insertAdjacentElement('afterend',launcher);
  const dialog=buildDialog(); launcher.onclick=async()=>{await renderList();dialog.showModal();};
})();
