'use strict';
(() => {
  const CONFIG_KEY = 'neon-terninger-v1';
  const MODE_KEY = 'neon-terninger-mode-v1';
  const BACKUP_KEY = 'neon-terninger-custom-backup-v1';
  const $ = id => document.getElementById(id);
  const face = text => ({text, imageId: ''});
  const die = (name, values) => ({name, faces: values.map(face)});

  const MODES = {
    romantic: {
      name: 'Romantisk', icon: '♡', kicker: 'BLØD START', description: 'Nærhed, søde ord og rolig kemi.',
      dice: [
        die('Nærhed', ['Hold i hånd i 30 sek.', 'Et langt kram', 'Sid helt tæt', 'Se hinanden i øjnene', 'Vælg jeres sang', 'Del et godt minde']),
        die('Kompliment', ['Smilet', 'Øjnene', 'Humoren', 'Personligheden', 'Noget du beundrer', 'Noget du savner']),
        die('Kys', ['Panden', 'Kinden', 'Hånden', 'Et blidt kys', 'Et langt kys', 'Partneren vælger']),
        die('Sammen', ['Planlæg en date', 'Fortæl om første indtryk', 'Vælg en fælles drøm', 'Giv et løfte for aftenen', 'Tag et billede sammen', 'Frikast ♡'])
      ]
    },
    flirty: {
      name: 'Flirtende', icon: '♥', kicker: 'MERE KEMI', description: 'Mere blik, spænding og drilleri.',
      dice: [
        die('Flirt', ['Giv dit bedste flirtende blik', 'Hvisk et kompliment', 'Fortæl hvad du faldt for', 'Send et frækt smil', 'Vælg partnerens næste pose til et foto', 'Partneren vælger']),
        die('Kys', ['Et hurtigt kys', 'Et langsomt kys', 'Tre kys i træk', 'Kys et valgfrit sted', 'Lad partneren vælge hvor', 'Kys og hold øjenkontakt']),
        die('Udfordring', ['Dans tæt i 30 sek.', 'Sid på skødet et øjeblik', 'Hvisk noget kun partneren må høre', 'Giv 20 sek. massage', 'Fortæl hvad der skaber kemi', 'Byt plads og kom tættere på']),
        die('Stemning', ['Dæmp lyset', 'Sæt en langsom sang på', 'Sluk telefonerne i 10 min.', 'Hent jeres yndlingsdrink', 'Tag et stemningsbillede', 'Frikast ♥'])
      ]
    },
    daring: {
      name: 'Vovet', icon: '✦', kicker: 'SKRU OP', description: 'Mere mod, berøring og fristelse.',
      dice: [
        die('Fristelse', ['Hold partneren tæt i 30 sek.', 'Giv et langt kys', 'Vælg et sted til et kys', 'Hvisk hvad du synes er uimodståeligt', 'Lad partneren styre næste minut', 'Hold øjenkontakt uden at grine']),
        die('Berøring', ['Hænder', 'Nakke', 'Skuldre', 'Ryg', 'Hår', 'Partneren vælger']),
        die('Vovet valg', ['Tag et valgfrit stykke overtøj af', 'Fortæl en fantasi om en perfekt date', 'Vis dit mest selvsikre blik', 'Lad partneren vælge din næste udfordring', 'Giv 45 sek. massage', 'Spring over eller dobbelt op næste kast']),
        die('Tid', ['10 sek.', '20 sek.', '30 sek.', '45 sek.', '1 minut', 'Så længe I begge vil'])
      ]
    },
    afterdark: {
      name: 'After Dark', icon: '◆', kicker: 'MIDNAT', description: 'Den mest intense, stadig på jeres præmisser.',
      dice: [
        die('Midnat', ['Et ekstra langt kys', 'Kom helt tæt på', 'Hvisk hvad der tænder stemningen', 'Vælg et sted på kroppen til et kys', 'Lad partneren bestemme næste udfordring', 'Tag en langsom dans helt tæt']),
        die('Hvem bestemmer?', ['Dig', 'Din partner', 'Sammen', 'Vinderen af sten-saks-papir', 'Den der slog terningen', 'Partneren vælger']),
        die('Udfordring', ['Giv et kys med lukkede øjne', 'Giv 1 minuts langsom massage', 'Fortæl hvad du gerne vil have mere af', 'Tag et valgfrit stykke tøj af', 'Sæt en grænse og vælg derefter en udfordring', 'Frikast ◆']),
        die('Intensitet', ['Blidt', 'Langsomt', 'Drilsk', 'Selvsikkert', 'Overrask mig', 'Som I begge har lyst til'])
      ]
    }
  };

  const readJSON = (key, fallback = null) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const current = readJSON(MODE_KEY, {id: 'custom'});
  if (current?.id && MODES[current.id]) document.body.dataset.intensity = current.id;

  function makeDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'mode-dialog'; dialog.setAttribute('aria-labelledby', 'mode-title');
    dialog.innerHTML = `
      <div class="dialog-heading mode-heading"><div><span class="eyebrow">SPILVÆLGER</span><h2 id="mode-title">Vælg stemningen</h2></div><button class="icon-button" id="close-mode" aria-label="Luk">×</button></div>
      <p class="muted mode-intro">Vælg et niveau og læg et færdigt sæt på de fire terninger. Bagefter kan du frit ændre tekst og tilføje dine egne billeder.</p>
      <div class="mode-safety"><span>♡</span><p><strong>Jeres regler gælder altid.</strong> Alt er frivilligt, og enhver udfordring kan springes over uden forklaring.</p></div>
      <div class="mode-grid" id="mode-grid"></div>
      <div class="mode-actions"><button class="secondary-button" id="restore-custom" type="button">↶ Gendan mine tidligere terninger</button></div>`;
    document.body.append(dialog);
    $('close-mode').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function renderCards(dialog) {
    const grid = $('mode-grid'); grid.replaceChildren();
    Object.entries(MODES).forEach(([id, mode]) => {
      const card = document.createElement('article'); card.className = `mode-card mode-${id}`;
      const names = mode.dice.map(d => d.name).join(' · ');
      card.innerHTML = `<div class="mode-card-top"><span class="mode-symbol">${mode.icon}</span><span class="mode-kicker">${mode.kicker}</span></div><h3>${mode.name}</h3><p>${mode.description}</p><small>${names}</small><button class="mode-apply" type="button">Brug ${mode.name}</button>`;
      card.querySelector('button').addEventListener('click', () => applyMode(id, dialog));
      grid.append(card);
    });
    const restore = $('restore-custom'); restore.hidden = !localStorage.getItem(BACKUP_KEY); restore.onclick = () => restoreCustom(dialog);
  }

  function applyMode(id, dialog) {
    const mode = MODES[id]; if (!mode) return;
    const existing = readJSON(CONFIG_KEY);
    const cameFromPreset = Boolean(MODES[current?.id]);
    if (existing?.version === 2 && !cameFromPreset && !localStorage.getItem(BACKUP_KEY)) writeJSON(BACKUP_KEY, existing);
    const config = {version: 2, count: 4, dice: mode.dice};
    if (!writeJSON(CONFIG_KEY, config) || !writeJSON(MODE_KEY, {id, name: mode.name, appliedAt: Date.now()})) {
      alert('Browseren kunne ikke gemme spiltilstanden. Kontroller at lokal lagring er tilladt.'); return;
    }
    dialog.close(); location.reload();
  }

  function restoreCustom(dialog) {
    const backup = readJSON(BACKUP_KEY);
    if (!backup?.dice) return;
    if (!writeJSON(CONFIG_KEY, backup) || !writeJSON(MODE_KEY, {id: 'custom', name: 'Mit eget sæt', appliedAt: Date.now()})) return;
    try { localStorage.removeItem(BACKUP_KEY); } catch {}
    dialog.close(); location.reload();
  }

  const sidebar = document.querySelector('.sidebar');
  const intro = document.querySelector('.sidebar .intro');
  if (!sidebar || !intro) return;
  const launcher = document.createElement('section'); launcher.className = 'mode-launcher';
  const activeMode = MODES[current?.id];
  launcher.innerHTML = `<div class="mode-launcher-copy"><span class="eyebrow">SPILTILSTAND</span><strong>${activeMode ? `${activeMode.icon} ${activeMode.name}` : '✦ Mit eget sæt'}</strong><small>${activeMode ? activeMode.description : 'Dine egne terninger, tekster og billeder.'}</small></div><button id="open-mode" type="button" aria-label="Vælg spiltilstand">Vælg <span>↗</span></button>`;
  intro.insertAdjacentElement('afterend', launcher);
  const dialog = makeDialog(); renderCards(dialog);
  $('open-mode').addEventListener('click', () => { renderCards(dialog); dialog.showModal(); });
})();
