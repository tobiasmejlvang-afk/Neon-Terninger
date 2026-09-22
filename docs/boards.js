'use strict';
(() => {
  const KEY = 'neon-terninger-board-v1';
  const EFFECTS_KEY = 'neon-terninger-effects-v1';
  const MODES = ['dice', 'slot', 'wheel'];
  const svgNS = 'http://www.w3.org/2000/svg';
  const mod = angle => ((angle % 360) + 360) % 360;
  // Sectors are centred on 0°, 360/n°, …, measured clockwise from the top.
  function targetRotation(count, index, current = 0) {
    if (!Number.isInteger(count) || count < 2 || count > 50 || !Number.isInteger(index) || index < 0 || index >= count) throw new Error('Ugyldigt hjulfelt.');
    return current + 5 * 360 + mod(-index * 360 / count - mod(current));
  }
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const svg = (tag, attributes) => { const node = document.createElementNS(svgNS, tag); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); return node; };
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const polar = (r, angle) => ({x: 200 + r * Math.sin(angle * Math.PI / 180), y: 200 - r * Math.cos(angle * Math.PI / 180)});
  const delay = duration => new Promise(resolve => setTimeout(resolve, duration));
  async function animate(node, keyframes, duration) {
    if (!node.animate) { Object.assign(node.style, keyframes[keyframes.length - 1]); await delay(duration); return; }
    const animation = node.animate(keyframes, {duration, easing: 'cubic-bezier(.12,.74,.15,1)', fill: 'forwards'});
    try { await animation.finished; } finally { Object.assign(node.style, keyframes[keyframes.length - 1]); animation.cancel(); }
  }

  function create({onChange, onSelect, faceLabel, imageURL}) {
    const $ = id => document.getElementById(id);
    let mode = read(KEY, 'dice'); if (!MODES.includes(mode)) mode = 'dice';
    let effects = read(EFFECTS_KEY, 'auto');
    if (!['auto', 'full', 'quiet'].includes(effects)) effects = 'auto';
    let state, paint = 0, revealTimer;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    // Follow the device until the player makes an explicit choice in this app.
    const reduce = () => effects === 'quiet' || (effects === 'auto' && media.matches);
    function effectState() {
      document.body.dataset.effects = reduce() ? 'quiet' : 'full';
      $('effects-button').textContent = reduce() ? '✦ Effekter fra' : '✦ Effekter til';
      $('effects-button').setAttribute('aria-pressed', String(!reduce()));
      $('effects-button').disabled = Boolean(state?.busy);
      $('effects-button').title = reduce() ? 'Slå animationer og glødende effekter til. Dit valg huskes på denne enhed.' : 'Slå animationer og glødende effekter fra. Dit valg huskes på denne enhed.';
    }
    effectState();
    media.addEventListener?.('change', effectState);
    $('effects-button').addEventListener('click', () => { if (state?.busy) return; effects = reduce() ? 'full' : 'quiet'; save(EFFECTS_KEY, effects); effectState(); });
    function setMode(value) {
      if (!MODES.includes(value)) throw new Error('Ukendt spilleplade.');
      if (state?.busy || document.querySelector('dialog[open]')) throw new Error('Afslut det igangværende slag eller den åbne dialog først.');
      mode = value; save(KEY, mode); onChange();
    }
    document.querySelectorAll('.board-choice').forEach(button => button.addEventListener('click', () => setMode(button.dataset.board)));

    async function paintImage(container, face, className) {
      if (!face?.imageId) return;
      const token = paint;
      const url = await imageURL(face.imageId);
      if (!url || token !== paint || !container.isConnected) return;
      const image = el('img', className); image.src = url; image.alt = face.text || 'Billedside'; container.prepend(image);
    }
    async function paintWheelResult(face, index) {
      const container = $('board-result-media'), token = paint;
      container.hidden = false;
      container.append(el('p', 'result-media-note', 'Indlæser billedet…'));
      const url = await imageURL(face.imageId);
      if (token !== paint || !container.isConnected) return;
      container.replaceChildren();
      if (!url) { container.append(el('p', 'result-media-note', 'Billedet kunne ikke indlæses.')); return; }
      const image = el('img', 'wheel-result-image');
      image.alt = face.text.trim() || `Billedside ${index + 1}`;
      image.addEventListener('error', () => {
        if (token === paint && container.isConnected) container.replaceChildren(el('p', 'result-media-note', 'Billedet kunne ikke indlæses.'));
      }, {once: true});
      image.src = url; container.append(image);
    }
    function shownFace(face, i, die) {
      const reveal = die?.reveal || state?.config.reveal || 'content';
      return reveal === 'content' ? face : {text: reveal === 'symbol' ? (die?.symbol || '✦') : String(i + 1), imageId:''};
    }
    function cell(face, i = 0, die) {
      if (face) face = shownFace(face, i, die);
      const node = el('div', 'reel-cell');
      const label = face ? faceLabel(face) : '✦';
      node.append(el('span', '', label)); node.title = label;
      if (face?.imageId) { node.classList.add('has-image'); void paintImage(node, face, 'reel-image'); }
      return node;
    }
    function makeSlots() {
      const machine = el('div', 'slot-machine');
      const marquee = el('div', 'slot-marquee'); marquee.append(el('small', '', 'ONE REEL AT A TIME'), el('strong', '', 'LUCKY SPIN'));
      const housing = el('div', 'slot-housing'), reels = el('div', 'reels'); reels.style.setProperty('--reels', state.config.count);
      state.config.dice.slice(0, state.config.count).forEach((die, i) => {
        const button = el('button', 'slot-reel'); button.type = 'button'; button.disabled = state.busy;
        button.setAttribute('aria-label', `Vælg hjul ${i + 1}: ${die.name}`); button.setAttribute('aria-pressed', String(i === state.selected));
        button.dataset.reel = i; button.addEventListener('click', () => onSelect(i, 'reel'));
        button.append(el('span', 'reel-caption', `HJUL 0${i + 1}`));
        const viewport = el('div', 'reel-viewport'), strip = el('div', 'reel-strip');
        const index = state.resultIndices[i];
        const previous = index === null ? die.faces.length - 1 : (index - 1 + die.faces.length) % die.faces.length;
        const following = index === null ? 0 : (index + 1) % die.faces.length;
        strip.append(cell(die.faces[previous], previous, die), cell(state.results[i], index ?? 0, die), cell(die.faces[following], following, die));
        viewport.append(strip, el('span', 'reel-payline')); button.append(viewport, el('span', 'reel-label', die.name)); reels.append(button);
      });
      housing.append(reels); for (let i = 0; i < 4; i++) housing.append(el('span', `machine-bolt bolt-${i}`));
      machine.append(marquee, housing, el('div', 'slot-foot', 'ÉT TRYK · ÉT HJUL · ÉT RESULTAT')); return machine;
    }
    function makeWheel() {
      const stage = el('div', 'wheel-stage'), rim = el('div', 'wheel-rim');
      const die = state.config.dice[state.selected], count = die.faces.length, step = 360 / count;
      const disc = svg('svg', {viewBox:'0 0 400 400', class:'wheel-disc', 'aria-label':`Spin-hjul med ${count} felter`, role:'img'});
      die.faces.forEach((original, i) => {
        const face = shownFace(original, i, die);
        const start = i * step - step / 2, end = start + step, a = polar(190, start), b = polar(190, end);
        const group = svg('g', {}), path = svg('path', {d:`M 200 200 L ${a.x} ${a.y} A 190 190 0 ${step > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`, class:'wheel-sector', fill:i % 2 === 0 ? '#8c0925' : '#210b12', stroke:'#ff47564d', 'stroke-width':'1'});
        const position = polar(count > 12 ? 151 : 139, i * step);
        const text = svg('text', {x:position.x, y:position.y, 'text-anchor':'middle', 'dominant-baseline':'middle', transform:`rotate(${i * step}, ${position.x}, ${position.y})`, class:'wheel-label', 'font-size':count > 30 ? '7' : count > 20 ? '9' : count > 12 ? '11' : '13'});
        const label = face.imageId && !face.text.trim() ? `Billede ${i + 1}` : faceLabel(face), maxLetters = count > 20 ? 3 : count > 12 ? 6 : count > 8 ? 8 : 12;
        text.textContent = face.imageId && !face.text.trim() && count > 8 ? `#${i + 1}` : [...label].length > maxLetters ? [...label].slice(0,maxLetters - 1).join('') + '…' : label;
        const title = svg('title', {}); title.textContent = `${i + 1}. ${label}`;
        group.append(title, path, text); disc.append(group);
      });
      const resultIndex = state.resultIndices[state.selected]; disc.style.transform = `rotate(${resultIndex === null ? 0 : mod(-resultIndex * step)}deg)`;
      const hub = el('div', 'wheel-hub'); hub.append(el('span', '', 'NEON'), el('strong', '', 'SPIN'));
      rim.append(disc, hub); stage.append(el('div', 'wheel-pointer'), rim, el('div', 'wheel-stand')); return stage;
    }
    function render(snapshot) {
      state = snapshot; paint++;
      const area = document.querySelector('.play-area'); area.dataset.board = mode;
      document.body.dataset.board = mode;
      document.querySelectorAll('.board-choice').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.board === mode)); button.disabled = state.busy; });
      document.querySelector('.die-stage').hidden = mode !== 'dice';
      $('board-surface').hidden = mode === 'dice'; $('board-surface').replaceChildren();
      if (mode === 'slot') $('board-surface').append(makeSlots());
      if (mode === 'wheel') $('board-surface').append(makeWheel());
      const resultMedia = $('board-result-media'), result = state.results[state.selected];
      resultMedia.hidden = true; resultMedia.replaceChildren();
      if (mode === 'wheel' && !state.busy && result?.imageId) {
        void paintWheelResult(result, state.resultIndices[state.selected]);
        if (!result.text.trim()) $('result-value').textContent = `Billedside ${state.resultIndices[state.selected] + 1}`;
      }
      $('count-label').textContent = mode === 'dice' ? 'Antal terninger' : 'Antal hjul';
      const die = state.config.dice[state.next];
      $('roll-label').textContent = state.busy ? (mode === 'dice' ? 'Terningen ruller…' : 'Hjulet ruller…') : mode === 'dice' ? `Slå ${state.results[state.next] ? 'igen med' : 'med'} ${die.name}` : mode === 'slot' ? `Rul hjul ${state.next + 1} · ${die.name}` : `Spin · ${die.name}`;
      const allDone = state.results.slice(0,state.config.count).every(Boolean);
      $('roll-hint').textContent = allDone ? 'Runden er komplet. Prøv igen, eller start en ny runde.' : mode === 'slot' ? 'Kun det valgte hjul ruller. De andre resultater bliver stående.' : mode === 'wheel' ? 'Markøren viser resultatet. Hvert felt har samme chance.' : 'Én terning ad gangen. Resten er op til jer.';
      $('progress-label').textContent = `${state.results.slice(0,state.config.count).filter(Boolean).length} af ${state.config.count} færdige`;
      effectState();
    }
    async function spin(index, outcome, faceView) {
      const die = state.config.dice[index], speed = Number(document.body.dataset.speed) || 1;
      const duration = reduce() ? 100 : (mode === 'dice' ? 1150 : mode === 'slot' ? 2300 : 2900) * speed;
      if (mode === 'dice') {
        const block = $('die-block'); block.classList.add('is-rolling');
        let frame = 0;
        const ticker = reduce() ? null : setInterval(() => faceView(shownFace(die.faces[frame % die.faces.length], frame++ % die.faces.length, die)), 110);
        try { await delay(duration); } finally { if (ticker) clearInterval(ticker); block.classList.remove('is-rolling'); }
      } else if (mode === 'slot') {
        const reel = document.querySelector(`[data-reel="${index}"]`), strip = reel.querySelector('.reel-strip');
        reel.classList.add('is-spinning');
        if (!reduce()) {
          const landing = Math.max(3, Math.ceil(28 / die.faces.length)) * die.faces.length + outcome;
          strip.replaceChildren();
          for (let i=0; i <= landing + 1; i++) strip.append(cell(die.faces[i % die.faces.length], i % die.faces.length, die));
          await animate(strip, [{transform:'translateY(0px)'}, {transform:`translateY(-${(landing - 1) * 80}px)`}], duration);
        } else await delay(duration);
        reel.classList.remove('is-spinning');
      } else {
        const disc = document.querySelector('.wheel-disc');
        const old = state.resultIndices[index]; const current = old === null ? 0 : mod(-old * 360 / die.faces.length);
        const target = targetRotation(die.faces.length, outcome, current);
        if (reduce()) { await delay(duration); disc.style.transform = `rotate(${mod(target)}deg)`; } else await animate(disc, [{transform:`rotate(${current}deg)`}, {transform:`rotate(${target}deg)`}], duration);
      }
    }
    function reveal() {
      const area = document.querySelector('.play-area'); clearTimeout(revealTimer); area.classList.remove('has-reveal');
      if (reduce()) return;
      const particles = $('reveal-particles'); particles.replaceChildren();
      for (let i=0;i<14;i++) { const particle = el('span'); const angle = i/14*Math.PI*2; particle.style.setProperty('--x', `${Math.cos(angle)*140}px`); particle.style.setProperty('--y', `${Math.sin(angle)*110}px`); particle.style.setProperty('--delay', `${i%3*40}ms`); particles.append(particle); }
      requestAnimationFrame(() => area.classList.add('has-reveal'));
      revealTimer = setTimeout(() => { area.classList.remove('has-reveal'); particles.replaceChildren(); },1300);
    }
    return {get mode(){return mode;}, get effects(){return effects;}, setEffects(value){if(state?.busy)return;if(!['auto','full','quiet'].includes(value))throw new Error('Ugyldigt effektvalg.');effects=value;save(EFFECTS_KEY,value);effectState();}, setMode, render, spin, reveal};
  }
  window.NeonBoards = {create, targetRotation};
})();
