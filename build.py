"""Rebuild the public site using only this archive. Python 3, standard library."""
import argparse,base64,hashlib,html,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--standalone',action='store_true',help='Recreate the original large, self-contained HTML files in standalone/');parser.add_argument('--verify',action='store_true',help='Verify every data part before building');args=parser.parse_args()
manifest=json.loads((ROOT/'data_manifest.json').read_text());payload=[]
for entry in manifest['entries']:
    tag=entry['tag'];content=entry.get('literal','')
    if 'parts' in entry:
        if args.verify or args.standalone:
            raw=b''.join((ROOT/p['path']).read_bytes() for p in entry['parts'])
            assert len(raw)==entry['gzip_bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256']
            for p in entry['parts']:assert hashlib.sha256((ROOT/p['path']).read_bytes()).hexdigest()==p['sha256']
        if args.standalone:content=base64.b64encode(raw).decode()
        else:tag=tag[:-1]+' data-parts="'+html.escape(json.dumps([p['path'] for p in entry['parts']]),quote=True)+'">'
    payload.append(entry['separator']+tag+content+'</script>')
payload=''.join(payload)
read=lambda name:(ROOT/'src'/name).read_text()
scripts=['threshold-profiles.js','reference-points.js','other-surveys.js','adjustments.js','source-data.js','sources-ui.js','data-and-correspondence.js','app.js']
app='\n'.join(read(name) for name in scripts)
if not args.standalone:
    helper='''  async function readCompressedFiles(paths){
    let position=0,reader;
    const compressed=new ReadableStream({async pull(controller){
      while(true){
        if(!reader){if(position>=paths.length){controller.close();return;}const response=await fetch(paths[position++]);if(!response.ok)throw new Error('Data file could not be loaded: '+response.status);reader=response.body.getReader();}
        const {value,done}=await reader.read();if(done){reader=null;continue;}controller.enqueue(value);return;
      }
    },async cancel(){await reader?.cancel();}});
    return JSON.parse(await new Response(compressed.pipeThrough(new DecompressionStream('gzip'))).text());
  }
'''
    assert app.count('  function loadBlock(key){')==1
    app=app.replace('  function loadBlock(key){',helper+'  function loadBlock(key){')
    needle="      const encoded=node.textContent;node.textContent='';return readCompressed(encoded);"
    assert app.count(needle)==1
    app=app.replace(needle,"      if(node.dataset.parts)return readCompressedFiles(JSON.parse(node.dataset.parts));\n"+needle)
css='\n'.join(read(n) for n in ['shared.css','international.css','data-correspondence.css'])
vendor='/* Chart.js 4.4.1\n'+(ROOT/'vendor/Chart-LICENSE.txt').read_text()+'\n*/\n'+(ROOT/'vendor/chart.umd.min.js').read_text()
csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src "+("'none'" if args.standalone else "'self'")+"; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
dest=ROOT/'standalone' if args.standalone else ROOT;dest.mkdir(exist_ok=True)
for design,name in [('design_a.html','inequality.html'),('design_b.html','inequality_observatory.html')]:
    page=read(design).replace('__CHART_JS__',vendor).replace('<script type="application/json" id="explorer-results">__EXPLORER_RESULTS__</script>',payload).replace('__APP_JS__',app).replace('__METHODS_HTML__',read('methods.html'))
    page=page.replace('</head>','<style>'+css+'</style>\n</head>',1).replace('<head>','<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">',1)
    encoded=page.encode();(dest/name).write_bytes(encoded)
    if name=='inequality_observatory.html':
        if args.standalone:assert hashlib.sha256(encoded).hexdigest()==manifest['source_html_sha256'],'Standalone does not match the released site'
        else:(dest/'index.html').write_bytes(encoded)
    print(name,len(encoded),'bytes')
print('Build verified.' if args.verify or args.standalone else 'Build complete.')
