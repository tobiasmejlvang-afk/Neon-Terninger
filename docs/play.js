'use strict';
(() => {
  const G=window.NeonGame, $=id=>document.getElementById(id), history=[];
  const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  // Session snapshots own their image blobs, so changing a package cannot erase history.
  window.addEventListener('neon:round-end',event=>{
    const state=event.detail;
    const entry={round:state.round,pack:$('player-turn').querySelector('.eyebrow')?.textContent||'Jeres spil',player:$('player-turn').querySelector('strong')?.textContent?.replace(' · din tur','')||'',time:new Date(),items:[],urls:[],expired:false};
    entry.ready=Promise.all(state.config.dice.slice(0,state.config.count).map(async(die,i)=>{
      const face=state.results[i];let blob=null;
      if(face?.imageId)try{blob=await G.media.get(face.imageId);}catch{}
      return {name:die.name,text:face?.text||'',played:!!face,hasImage:!!face?.imageId,blob};
    })).then(items=>{entry.items=items;if(entry.expired)entry.items=[];});
    history.unshift(entry);
    if(history.length>20){const old=history.pop();old.expired=true;old.urls.forEach(URL.revokeObjectURL);old.items=[];}
  });
  $('history-button').onclick=async()=>{
    if(G.busy)return;
    const box=$('history-list');box.replaceChildren(make('p','Indlæser runder…'));
    $('round-history').showModal();
    await Promise.all(history.map(e=>e.ready));box.replaceChildren();
    if(!history.length){box.append(make('p','Ingen afsluttede runder endnu. Slå, og tryk derefter på Ny runde.'));return;}
    history.forEach(entry=>{
      const group=make('section');group.className='history-round';
      group.append(make('h3',`Runde ${entry.round} · ${entry.player}`),make('p',`${entry.pack} · ${entry.time.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}`));
      entry.items.forEach((item,i)=>{const row=make('div');row.className='history-result';
        if(item.blob){if(!entry.urls[i])entry.urls[i]=URL.createObjectURL(item.blob);const img=make('img');img.src=entry.urls[i];img.alt=item.text||'Billedresultat';row.append(img);}
        const copy=make('div');copy.append(make('small',item.name),make('p',!item.played?'Ikke spillet':item.text||(item.hasImage?'Billedresultat':'—')));row.append(copy);group.append(row);
      });box.append(group);
    });
  };
  $('close-history').onclick=()=>$('round-history').close();
  const fullscreen=$('fullscreen-button');
  if(!document.fullscreenEnabled){fullscreen.textContent='⛶ Fokusvisning';fullscreen.title='Skjul menuen og giv spillepladen mere plads';}
  fullscreen.onclick=async()=>{
    try{
      if(document.fullscreenEnabled){if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
      else {document.body.classList.toggle('play-focus');updateFullscreen();}
    }catch{$('announcement').textContent='Fuldskærm kunne ikke åbnes. Prøv browserens fuldskærmsfunktion.';}
  };
  function updateFullscreen(){const active=document.fullscreenEnabled?!!document.fullscreenElement:document.body.classList.contains('play-focus');fullscreen.setAttribute('aria-pressed',String(active));fullscreen.textContent=active?'↙ Vis menu':document.fullscreenEnabled?'⛶ Fuldskærm':'⛶ Fokusvisning';document.body.classList.toggle('play-focus',active);}
  document.addEventListener('fullscreenchange',updateFullscreen);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.fullscreenElement){document.body.classList.remove('play-focus');updateFullscreen();}});
  function badge(){const board=G.board;$('board-badge').textContent={dice:'TERNINGER',slot:'LUCKY SPIN',wheel:'ROULETTE'}[board]||'';}
  new MutationObserver(badge).observe(document.querySelector('.play-area'),{attributes:true,attributeFilter:['data-board']});badge();
  new MutationObserver(()=>{$('history-button').disabled=G.busy;}).observe($('roll-button'),{attributes:true,attributeFilter:['disabled']});
})();
