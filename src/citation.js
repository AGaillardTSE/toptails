(() => {
  const authors=[['Gaillard','Alexandre'],['Hellwig','Christian'],['Wangner','Philipp'],['Werquin','Nicolas']];
  const title='Consumption, Wealth, and Income Inequality: A Tale of Tails',year='2026';
  const paperURL='https://www.dropbox.com/scl/fi/zl65lsrvzd8yrr2kic24n/GHWW_2026.pdf?rlkey=lymccj7wbuqr91rimf39802f5&e=2&dl=0';
  const formats={
    bibtex:{label:'BibTeX',extension:'bib',mime:'application/x-bibtex',text:`@unpublished{GaillardHellwigWangnerWerquin2026,
  author = {Gaillard, Alexandre and Hellwig, Christian and
            Wangner, Philipp and Werquin, Nicolas},
  title  = {${title}},
  year   = {${year}},
  note   = {Working paper},
  url    = {${paperURL}}
}`},
    endnote:{label:'EndNote',extension:'enw',mime:'text/plain',text:['%0 Unpublished Work',...authors.map(([last,first])=>'%A '+last+', '+first),'%D '+year,'%T '+title,'%9 Working paper','%U '+paperURL].join('\n')},
    refer:{label:'Refer/BibIX',extension:'refer',mime:'text/plain',text:[...authors.map(([last,first])=>'%A '+first+' '+last),'%T '+title,'%D '+year,'%O Working paper','%U '+paperURL].join('\n')},
    ris:{label:'RIS',extension:'ris',mime:'application/x-research-info-systems',text:['TY  - UNPB',...authors.map(([last,first])=>'AU  - '+last+', '+first),'TI  - '+title,'PY  - '+year,'N1  - Working paper','UR  - '+paperURL,'ER  -'].join('\n')},
    tsv:{label:'Tab-Delimited',extension:'tsv',mime:'text/tab-separated-values',text:[['Reference Type','Author','Year','Title','URL'].join('\t'),['Working paper',authors.map(([last,first])=>last+', '+first).join('; '),year,title,paperURL].join('\t')].join('\n')}
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=formats;
  if(typeof document==='undefined')return;
  const trigger=document.querySelector('[data-citation-trigger]');
  if(!trigger)return;
  const dialog=document.createElement('dialog');
  dialog.className='citation-dialog';dialog.id='paper-citation-dialog';
  dialog.setAttribute('aria-labelledby','paper-citation-title');
  dialog.innerHTML='<form method="dialog" class="citation-close-form"><button class="text-button" aria-label="Close citation">Close</button></form><p class="citation-kicker">Reference</p><h2 id="paper-citation-title">Citation</h2><p class="paper-citation">Gaillard, A., Hellwig, C., Wangner, P., and Werquin, N. (2026). “<cite>Consumption, Wealth, and Income Inequality: A Tale of Tails.</cite>” <a class="citation-paper-link" target="_blank" rel="noopener noreferrer">Working paper.</a></p><label class="citation-format">Format<select aria-label="Citation format"></select></label><pre tabindex="0"><code></code></pre><div class="citation-actions"><button class="text-button" type="button" data-copy-citation></button><button class="text-button" type="button" data-download-citation></button><span class="citation-status" role="status" aria-live="polite"></span></div>';
  dialog.querySelector('.citation-paper-link').href=paperURL;
  const select=dialog.querySelector('select'),code=dialog.querySelector('code'),status=dialog.querySelector('.citation-status'),copy=dialog.querySelector('[data-copy-citation]'),download=dialog.querySelector('[data-download-citation]');
  for(const [key,format] of Object.entries(formats))select.add(new Option(format.label,key));
  const current=()=>formats[select.value];
  function render(){const format=current();code.textContent=format.text;code.parentElement.setAttribute('aria-label','Paper citation in '+format.label);copy.textContent='Copy '+format.label;download.textContent='Download .'+format.extension;status.textContent='';}
  select.addEventListener('change',render);render();document.body.append(dialog);
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
  trigger.addEventListener('click',()=>{status.textContent='';dialog.showModal();});
  dialog.addEventListener('close',()=>trigger.focus());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  copy.addEventListener('click',async()=>{
    const format=current();
    try{await navigator.clipboard.writeText(format.text);if(current()===format)status.textContent=format.label+' copied.';}
    catch{if(current()!==format)return;const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent=format.label+' selected. Use your copy shortcut.';}
  });
  download.addEventListener('click',()=>{
    const format=current(),downloadURL=URL.createObjectURL(new Blob([format.text+'\n'],{type:format.mime+';charset=utf-8'})),link=document.createElement('a');
    link.href=downloadURL;link.download='Gaillard-Hellwig-Wangner-Werquin-2026.'+format.extension;link.click();setTimeout(()=>URL.revokeObjectURL(downloadURL),1000);
  });
})();
