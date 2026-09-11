'use strict';
(() => {
  const KEY = 'neon-terninger-v1';
  const $ = (id) => document.getElementById(id);
  const defaults = () => ({ version: 1, count: 4, dice: Array.from({length: 4}, (_, i) => ({name: `Terning ${i + 1}`, faces: ['1', '2', '3', '4', '5', '6']})) });
  const valid = (data) => data && data.version === 1 && Number.isInteger(data.count) && data.count >= 1 && data.count <= 4 && Array.isArray(data.dice) && data.dice.length === 4 && data.dice.every(d => typeof d.name === 'string' && d.name.trim().length > 0 && d.name.length <= 30 && Array.isArray(d.faces) && d.faces.length >= 2 && d.faces.length <= 20 && d.faces.every(f => typeof f === 'string' && f.trim().length > 0 && f.length <= 80));
  let config = defaults();
  let storageOK = true;
  try { const stored = localStorage.getItem(KEY); if (stored) { const parsed = JSON.parse(stored); if (valid(parsed)) config = parsed; } } catch { storageOK = false; }
  let selected = 0, next = 0, round = 1, busy = false, results = [null, null, null, null];
  let draft, editing = 0;
  const announce = (text) => { $('announcement').textContent = text; };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(config)); storageOK = true; } catch { storageOK = false; announce('Ændringerne virker nu, men browseren kunne ikke gemme dem.'); } updateStorage(); }
  function updateStorage() { $('storage-label').textContent = storageOK ? 'Gemt på denne enhed' : 'Kun gemt indtil siden lukkes'; }
  function element(tag, className, content) { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = content; return el; }
  function resetRound(increment = true) { if (busy) return; if (increment) round++; selected = 0; next = 0; results = [null, null, null, null]; render(); }
  function setCount(count) { if (busy || !Number.isInteger(count) || count < 1 || count > 4) return; config.count = count; save(); resetRound(false); $("dice-count").children[count - 1].focus(); }
  function selectDie(index) { if (busy || index < 0 || index >= config.count) return; selected = index; next = index; render(); $("dice-list").children[index].focus(); }
  function faceView(value) {
    const face = $('die-face'); face.replaceChildren(); face.classList.toggle('long-face', value !== null && value.length > 24);
    if (value === null) { face.append(element('span', 'question-mark', '?')); return; }
    const patterns = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
    if (Object.hasOwn(patterns, value)) { const pips = element('div', 'die-pips'); pips.setAttribute('aria-label', value); for (let i = 0; i < 9; i++) { const dot = element('span', patterns[value].includes(i) ? 'pip' : ''); dot.setAttribute('aria-hidden', 'true'); pips.append(dot); } face.append(pips); } else face.textContent = value;
  }
  function render() {
    const countButtons = $('dice-count'); countButtons.replaceChildren();
    for (let i = 1; i <= 4; i++) { const button = element('button', '', String(i)); button.type = 'button'; button.setAttribute('aria-label', `${i} ${i === 1 ? 'terning' : 'terninger'}`); button.setAttribute('aria-pressed', String(config.count === i)); button.disabled = busy; button.addEventListener('click', () => setCount(i)); countButtons.append(button); }
    const list = $('dice-list'); list.replaceChildren();
    config.dice.slice(0, config.count).forEach((die, i) => { const button = element('button', 'dice-card'); button.setAttribute('aria-pressed', String(selected === i)); button.setAttribute('aria-label', `Vælg ${die.name}`); button.disabled = busy; button.append(element('span', 'die-number', `0${i + 1}`)); const label = element('span', 'dice-card-text'); label.append(element('strong', '', die.name), element('small', '', `${die.faces.length} sider${results[i] !== null ? ' · Kastet' : ''}`)); button.append(label, element('span', 'card-status', selected === i ? '↗' : results[i] !== null ? '✓' : '')); button.addEventListener('click', () => selectDie(i)); list.append(button); });
    $('round-label').textContent = `RUNDE ${String(round).padStart(2, '0')}`;
    $('active-name').textContent = config.dice[selected].name;
    faceView(results[selected]);
    $('result-caption').textContent = results[selected] === null ? 'KLAR TIL ET SLAG' : 'DIT RESULTAT';
    $('result-value').textContent = results[selected] === null ? 'Hvad mon det bliver?' : results[selected];
    const complete = results.slice(0, config.count).every(r => r !== null);
    $('roll-label').textContent = busy ? 'Terningen ruller…' : `Slå ${results[next] !== null ? 'igen med' : 'med'} ${config.dice[next].name}`;
    $('roll-button').disabled = busy;
    $('new-round').disabled = busy;
    $('edit-button').disabled = busy;
    $('roll-hint').textContent = complete ? 'Alle terninger er kastet. Slå igen, eller start en ny runde.' : 'Én terning ad gangen. Helt på dine præmisser.';
    $('progress-label').textContent = `${results.slice(0, config.count).filter(r => r !== null).length} af ${config.count} kastet`;
    const summaries = $('results-list'); summaries.replaceChildren(); summaries.style.setProperty('--count', config.count);
    config.dice.slice(0, config.count).forEach((die, i) => { const card = element('div', `result-card${results[i] !== null ? ' has-result' : ''}`); card.append(element('small', '', die.name), element('strong', '', results[i] ?? '—')); summaries.append(card); });
    updateStorage();
  }
  // Rejection sampling avoids bias for any supported number of sides.
  function randomIndex(length) { const limit = Math.floor(4294967296 / length) * length; const data = new Uint32Array(1); do { crypto.getRandomValues(data); } while (data[0] >= limit); return data[0] % length; }
  async function roll(index = next) {
    if (busy) throw new Error('En terning ruller allerede.');
    if (!Number.isInteger(index) || index < 0 || index >= config.count) throw new Error('Vælg en aktiv terning.');
    busy = true; selected = index; render();
    $('result-caption').textContent = 'SPÆNDINGEN STIGER'; $('result-value').textContent = 'Terningen ruller…';
    const die = config.dice[index];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('die-block').classList.add('is-rolling');
    const ticker = reduce ? null : setInterval(() => faceView(die.faces[randomIndex(die.faces.length)]), 95);
    await new Promise(resolve => setTimeout(resolve, reduce ? 120 : 850));
    if (ticker !== null) clearInterval(ticker);
    results[index] = die.faces[randomIndex(die.faces.length)];
    $('die-block').classList.remove('is-rolling');
    busy = false;
    next = index;
    for (let offset = 1; offset <= config.count; offset++) { const candidate = (index + offset) % config.count; if (results[candidate] === null) { next = candidate; break; } }
    render(); announce(`${die.name}: ${results[index]}. ${results.slice(0, config.count).filter(r => r !== null).length} af ${config.count} terninger kastet.`);
    return {die: die.name, result: results[index]};
  }
  function openEditor() { if (busy) return; draft = JSON.parse(JSON.stringify(config.dice)); editing = selected; $('editor-error').textContent = ''; renderEditor(); $('editor').showModal(); }
  function renderEditor() {
    const tabs = $('editor-tabs'); tabs.replaceChildren();
    draft.forEach((die, i) => { const button = element('button', '', `Terning ${i + 1}`); button.type = 'button'; button.setAttribute('aria-pressed', String(i === editing)); button.addEventListener('click', () => { editing = i; renderEditor(); $("editor-tabs").children[i].focus(); }); tabs.append(button); });
    $('die-name').value = draft[editing].name;
    const container = $('face-inputs'); container.replaceChildren();
    draft[editing].faces.forEach((value, i) => { const row = element('div', 'face-row'); const label = element('label', '', String(i + 1).padStart(2, '0')); label.htmlFor = `face-${i}`; const input = element('input'); input.id = `face-${i}`; input.value = value; input.maxLength = 80; input.required = true; input.setAttribute('aria-label', `Side ${i + 1}`); input.addEventListener('input', () => { draft[editing].faces[i] = input.value; }); const remove = element('button', 'remove-face', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Fjern side ${i + 1}`); remove.disabled = draft[editing].faces.length <= 2; remove.addEventListener('click', () => { draft[editing].faces.splice(i, 1); renderEditor(); const remaining = $('face-inputs').querySelectorAll('.remove-face'); remaining[Math.min(i, remaining.length - 1)].focus(); }); row.append(label, input, remove); container.append(row); });
    $('face-count').textContent = `(${draft[editing].faces.length})`;
    $('add-face').disabled = draft[editing].faces.length >= 20;
  }
  $('die-name').addEventListener('input', () => { draft[editing].name = $('die-name').value; });
  $('add-face').addEventListener('click', () => { if (draft[editing].faces.length >= 20) return; draft[editing].faces.push(''); renderEditor(); $('face-inputs').lastElementChild.querySelector('input').focus(); });
  $('editor-form').addEventListener('submit', (event) => { event.preventDefault(); const normalized = draft.map(d => ({name: d.name.trim(), faces: d.faces.map(f => f.trim())})); const bad = normalized.findIndex(d => !d.name || d.faces.some(f => !f)); if (bad !== -1) { editing = bad; renderEditor(); $('editor-error').textContent = `Udfyld navn og alle sider på terning ${bad + 1}.`; return; } config.dice = normalized; save(); $('editor').close(); resetRound(false); announce(storageOK ? 'Dine terninger er gemt. Klar til en ny runde.' : 'Terningerne er ændret, men kunne ikke gemmes på enheden.'); });
  ['close-editor', 'cancel-editor'].forEach(id => $(id).addEventListener('click', () => $('editor').close()));
  $('edit-button').addEventListener('click', openEditor);
  $('roll-button').addEventListener('click', () => { if (!busy) void roll(); });
  $('new-round').addEventListener('click', () => { resetRound(); announce('Ny runde. Dine terninger er klar.'); });
  $('help-button').addEventListener('click', () => $('help').showModal());
  $('close-help').addEventListener('click', () => $('help').close());
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  // Optional agent access uses exactly the same validated actions as the buttons.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = (tool) => { try { Promise.resolve(document.modelContext.registerTool(tool, {signal: lifecycle.signal})).catch(() => {}); } catch {} };
    register({name:'read_dice_game', description:'Read active dice, sides and current round results.', inputSchema:{type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:true}, execute:() => ({count:config.count,dice:JSON.parse(JSON.stringify(config.dice.slice(0,config.count))),results:[...results.slice(0,config.count)],round,busy})});
    register({name:'roll_one_die', description:'Roll one active die (1–4). Waits for the result. Fails while another die is rolling.', inputSchema:{type:'object',properties:{die:{type:'integer',minimum:1,maximum:4}},required:['die'],additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:true}, execute:async(input) => { if (!input || !Number.isInteger(input.die)) throw new Error('die must be an integer'); if ($('editor').open || $('help').open) throw new Error('Close the open dialog first.'); return roll(input.die - 1); }});
    window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
  }
})();
