(() => {
  const trigger=document.querySelector('[data-footer-citation]');
  if(!trigger)return;
  const paperURL='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';
  const bibtex=`@unpublished{GaillardHellwigWangnerWerquin2026,
  author = {Gaillard, Alexandre and Hellwig, Christian and
            Wangner, Philipp and Werquin, Nicolas},
  title  = {Consumption, Wealth, and Income Inequality: A Tale of Tails},
  year   = {2026},
  note   = {Working paper},
  url    = {https://uppertaildata.com/}
}`;
  const dialog=document.createElement('dialog');
  dialog.className='citation-dialog';dialog.id='paper-citation-dialog';
  dialog.setAttribute('aria-labelledby','paper-citation-title');
  dialog.innerHTML='<form method="dialog" class="citation-close-form"><button class="text-button" aria-label="Close citation">Close</button></form><p class="citation-kicker">Reference</p><h2 id="paper-citation-title">Citation</h2><p class="paper-citation">Gaillard, A., Hellwig, C., Wangner, P., and Werquin, N. (2026). “<cite>Consumption, Wealth, and Income Inequality: A Tale of Tails.</cite>” <a class="citation-paper-link" target="_blank" rel="noopener noreferrer">Working paper.</a></p><h3>BibTeX</h3><pre tabindex="0" aria-label="Paper citation in BibTeX"><code></code></pre><div class="citation-actions"><button class="text-button" type="button" data-copy-bibtex>Copy BibTeX</button><button class="text-button" type="button" data-download-bibtex>Download .bib</button><span class="citation-status" role="status" aria-live="polite"></span></div>';
  dialog.querySelector('.citation-paper-link').href=paperURL;
  const code=dialog.querySelector('code'),status=dialog.querySelector('.citation-status');
  code.textContent=bibtex;document.body.append(dialog);
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
  trigger.addEventListener('click',()=>{status.textContent='';dialog.showModal();});
  dialog.addEventListener('close',()=>trigger.focus());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.querySelector('[data-copy-bibtex]').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(bibtex);status.textContent='BibTeX copied.';}
    catch{const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='BibTeX selected. Use your copy shortcut.';}
  });
  dialog.querySelector('[data-download-bibtex]').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([bibtex+'\n'],{type:'application/x-bibtex;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='Gaillard-Hellwig-Wangner-Werquin-2026.bib';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
