'use strict';
(() => {
  const phases = ['Nu', 'Senere', 'Finale'];
  const statuses = ['klar', 'aktiv', 'udført', 'sprunget over'];
  function validateSession(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.items) || s.items.length > 1000 || !Array.isArray(s.history) || s.history.length > 100) throw new Error('Ugyldig Fusion-backup.');
    for (const item of s.items) {
      if (!item || typeof item.id !== 'string' || typeof item.text !== 'string' || item.text.length > 500 || !phases.includes(item.phase) || !statuses.includes(item.status) || typeof item.player !== 'string' || !Number.isFinite(item.seconds) || item.seconds < 0 || item.seconds > 3600) throw new Error('Et Action Board-kort er ugyldigt.');
    }
    if (new Set(s.items.map(i => i.id)).size !== s.items.length) throw new Error('Kort-id skal være unikke.');
    if (s.game) {
      const g=s.game;window.NeonStudioModel.validate(window.NeonStudioModel.normalize(g.config));
      if(!Array.isArray(g.results)||g.results.length!==6||!Array.isArray(g.resultIndices)||g.resultIndices.length!==6||!Number.isInteger(g.round)||g.round<1||g.round>100000||![g.selected,g.next].every(i=>Number.isInteger(i)&&i>=0&&i<g.config.count))throw new Error('Ugyldigt sessionssnapshot.');
      for(let i=0;i<g.config.count;i++){const n=g.resultIndices[i];if(n!==null&&(!Number.isInteger(n)||n<0||n>=g.config.dice[i].faces.length))throw new Error('Ugyldigt gemt resultat.');}
      if(!Array.isArray(g.images)||g.images.some(a=>!a||typeof a.id!=='string'||a.id.length>100||!(a.blob instanceof Blob)))throw new Error('Ugyldige sessionsbilleder.');
      for(const face of g.config.dice.flatMap(d=>d.faces))if(face.imageId&&!g.images.some(a=>a.id===face.imageId))throw new Error('Backup mangler et sessionsbillede.');
    }
    if(s.history.some(h=>!h||typeof h.text!=='string'||h.text.length>500||typeof h.player!=='string'||!Number.isFinite(h.time)||!Number.isInteger(h.round)))throw new Error('Ugyldig historik.');
    if(s.pathLength!==undefined&&(!Number.isInteger(s.pathLength)||s.pathLength<24||s.pathLength>64))throw new Error('Ugyldig brætlængde.');
    if (s.positions && (typeof s.positions !== 'object' || Array.isArray(s.positions) || Object.values(s.positions).some(n => !Number.isInteger(n) || n < 0 || n >= 64))) throw new Error('Ugyldig brikposition.');
    return true;
  }
  function move(items, id, beforeId, phase) {
    if (!phases.includes(phase)) throw new Error('Ukendt fase.');
    const copy = structuredClone(items), index = copy.findIndex(i => i.id === id);
    if (index < 0 || id === beforeId) return copy;
    const [item] = copy.splice(index, 1); item.phase = phase;
    const target = copy.findIndex(i => i.id === beforeId);
    if (target < 0) copy.push(item); else copy.splice(target, 0, item);
    return copy;
  }
  function pathStep(position, steps, length) {
    if (![position, steps, length].every(Number.isInteger) || length < 24 || length > 64 || position < 0 || position >= length || steps < 1 || steps > 50) throw new Error('Ugyldigt brættræk.');
    return (position + steps) % length;
  }
  window.NeonFusionModel = {phases, statuses, validateSession, move, pathStep};
})();
