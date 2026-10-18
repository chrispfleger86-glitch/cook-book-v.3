
const DB_NAME = 'cookbook-library-v3';
const DB_VERSION = 1;
let dbConn;
let stream = null;
let scanTimer = null;
let indexFiles = [];
let fullFiles = [];
let currentRecipeId = null;
let deferredPrompt = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
const cleanISBN = s => String(s||'').replace(/[^0-9Xx]/g,'').toUpperCase();

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('books')) db.createObjectStore('books',{keyPath:'id'});
      if(!db.objectStoreNames.contains('recipes')) {
        const s = db.createObjectStore('recipes',{keyPath:'id'});
        s.createIndex('bookId','bookId',{unique:false});
      }
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
function store(name,mode='readonly'){ return dbConn.transaction(name,mode).objectStore(name); }
function idbGetAll(name){
  return new Promise((resolve,reject)=>{const r=store(name).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
}
function idbGet(name,key){
  return new Promise((resolve,reject)=>{const r=store(name).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
}
function idbPut(name,value){
  return new Promise((resolve,reject)=>{const r=store(name,'readwrite').put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error)});
}
function idbDelete(name,key){
  return new Promise((resolve,reject)=>{const r=store(name,'readwrite').delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
}
function idbClear(name){
  return new Promise((resolve,reject)=>{const r=store(name,'readwrite').clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
}
async function getBooks(){return await idbGetAll('books')}
async function getRecipes(){return await idbGetAll('recipes')}
async function getBook(id){return await idbGet('books',id)}
async function getRecipe(id){return await idbGet('recipes',id)}

function setPage(name){
  $$('.page').forEach(x=>x.classList.add('hidden'));
  $('#'+name).classList.remove('hidden');
  $$('.tab[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  if(['indexbook','fullrecipe','shopping'].includes(name)) refreshSelectors();
}
$$('.tab[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));

async function renderAll(){
  await renderLibrary();
  await refreshSelectors();
}
async function renderLibrary(){
  const books = await getBooks();
  const recipes = await getRecipes();
  const q = ($('#searchInput').value||'').trim().toLowerCase();
  const fav = $('#filterFav').checked;
  const full = $('#filterFull').checked;
  const cooked = $('#filterCooked').checked;
  const want = $('#filterWant').checked;

  $('#stats').innerHTML = `
    <span class="pill">${books.length} cookbook${books.length===1?'':'s'}</span>
    <span class="pill">${recipes.length} indexed recipe${recipes.length===1?'':'s'}</span>
    <span class="pill">${recipes.filter(r=>r.full).length} full recipe${recipes.filter(r=>r.full).length===1?'':'s'}</span>
    <span class="pill">${recipes.filter(r=>r.favourite).length} favourite${recipes.filter(r=>r.favourite).length===1?'':'s'}</span>
  `;

  const grid = $('#libraryGrid');
  const html = [];
  for(const b of books.sort((a,z)=>(a.title||'').localeCompare(z.title||''))){
    let rs = recipes.filter(r=>r.bookId===b.id);
    rs = rs.filter(r=>{
      const hay=[r.title,r.pages,r.country,r.cuisine,(r.tags||[]).join(' '),r.ingredients,r.method,r.notes,b.title,b.author,b.country,b.cuisine].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!fav || r.favourite) && (!full || r.full) && (!cooked || (r.cookedCount||0)>0) && (!want || r.wantToCook);
    });
    const bookHay=[b.title,b.author,b.isbn,b.country,b.cuisine].join(' ').toLowerCase();
    const bookMatches = !q || bookHay.includes(q) || rs.length;
    if(!bookMatches || (fav||full||cooked||want) && !rs.length) continue;
    rs.sort((a,z)=>(a.title||'').localeCompare(z.title||''));
    html.push(`<article class="card">
      <div class="book-head">
        ${b.cover?`<img class="cover" src="${esc(b.cover)}" alt="">`:`<div class="cover"></div>`}
        <div>
          <div class="book-title">${esc(b.title)}</div>
          <div class="muted">${esc(b.author||'Unknown author')}</div>
          ${b.country?`<span class="pill">${esc(b.country)}</span>`:''}
          ${b.cuisine?`<span class="pill">${esc(b.cuisine)}</span>`:''}
          <span class="pill">${rs.length} shown</span>
        </div>
      </div>
      <div class="top-gap">
        ${rs.length?rs.map(r=>`<div class="recipe-line">
          <div>
            <strong>${r.favourite?'★ ':''}${esc(r.title)}</strong>
            <div class="small muted">${r.pages?'p. '+esc(r.pages):'No page'}${r.full?' · full recipe':''}${r.wantToCook?' · want to cook':''}${(r.cookedCount||0)?` · cooked ${r.cookedCount}×`:''}${r.rating?` · ${'★'.repeat(r.rating)}`:''}</div>
          </div>
          <button class="btn ghost small" onclick="openRecipe('${r.id}')">Open</button>
        </div>`).join(''):'<div class="empty">No matching recipes in this book.</div>'}
      </div>
      <div class="row top-gap">
        <button class="btn secondary small" onclick="startIndexForBook('${b.id}')">Index more</button>
        <button class="btn danger small" onclick="deleteBook('${b.id}')">Delete book</button>
      </div>
    </article>`);
  }
  grid.innerHTML = html.join('') || '<div class="card empty">No matching cookbooks or recipes.</div>';
}
['searchInput','filterFav','filterFull','filterCooked','filterWant'].forEach(id=>$('#'+id).addEventListener('input',renderLibrary));

async function refreshSelectors(){
  const books=await getBooks();
  const opts = books.length?books.sort((a,z)=>(a.title||'').localeCompare(z.title||'')).map(b=>`<option value="${b.id}">${esc(b.title)}</option>`).join(''):'<option value="">Add a cookbook first</option>';
  $('#indexBookSelect').innerHTML=opts;
  $('#fullBookSelect').innerHTML=opts;
  await renderExistingRecipeSelect();
  await renderShoppingPicker();
}
async function renderExistingRecipeSelect(){
  const bookId=$('#fullBookSelect').value;
  const recipes=(await getRecipes()).filter(r=>r.bookId===bookId).sort((a,z)=>(a.title||'').localeCompare(z.title||''));
  $('#existingRecipeSelect').innerHTML='<option value="">Create a new full recipe</option>'+recipes.map(r=>`<option value="${r.id}">${esc(r.title)}${r.pages?' · p. '+esc(r.pages):''}</option>`).join('');
}
$('#fullBookSelect').addEventListener('change',renderExistingRecipeSelect);

window.startIndexForBook=async id=>{setPage('indexbook');await refreshSelectors();$('#indexBookSelect').value=id};

async function lookupISBN(isbn){
  isbn=cleanISBN(isbn);
  if(!(isbn.length===10||isbn.length===13)) throw new Error('Please enter a valid ISBN-10 or ISBN-13.');
  const st=$('#scanStatus');st.textContent='Looking up book…';st.className='status show';
  const res=await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if(!res.ok) throw new Error('Book not found automatically. You can enter the details manually.');
  const d=await res.json();
  let author='Unknown author';
  if(d.authors?.[0]?.key){
    try{ const a=await fetch(`https://openlibrary.org${d.authors[0].key}.json`).then(r=>r.json()); author=a.name||author }catch(e){}
  }
  const cover=d.covers?.[0]?`https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg`:'';
  $('#bookTitle').value=d.title||'';
  $('#bookAuthor').value=author;
  $('#bookIsbn').value=isbn;
  $('#bookCover').value=cover;
  $('#manualBook').classList.remove('hidden');
  $('#bookPreview').innerHTML=`<div class="book-head">${cover?`<img class="cover" src="${cover}" alt="">`:'<div class="cover"></div>'}<div><div class="book-title">${esc(d.title||'Unknown title')}</div><div class="muted">${esc(author)}</div><span class="pill">${isbn}</span></div></div>`;
  st.textContent='Book found. Check the details, then add it.';
}
$('#lookupBook').addEventListener('click',()=>lookupISBN($('#isbnInput').value).catch(e=>{
  const st=$('#scanStatus');st.textContent=e.message;st.className='status show warn';$('#manualBook').classList.remove('hidden');$('#bookIsbn').value=cleanISBN($('#isbnInput').value)
}));
$('#saveBook').addEventListener('click',async()=>{
  const title=$('#bookTitle').value.trim();
  if(!title) return alert('Add a book title first.');
  const isbn=cleanISBN($('#bookIsbn').value);
  const books=await getBooks();
  if(isbn && books.some(b=>b.isbn===isbn)) return alert('That ISBN is already in your library.');
  const book={id:uid(),title,author:$('#bookAuthor').value.trim(),isbn,cover:$('#bookCover').value.trim(),country:$('#bookCountry').value.trim(),cuisine:$('#bookCuisine').value.trim(),createdAt:new Date().toISOString()};
  await idbPut('books',book);
  await renderAll();
  setPage('indexbook');
  $('#indexBookSelect').value=book.id;
});

async function startCamera(){
  const st=$('#scanStatus');
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    $('#video').srcObject=stream;await $('#video').play();$('#cameraText').classList.add('hidden');
    if(!('BarcodeDetector' in window)){st.textContent='Live barcode detection is not supported in this browser. Use manual ISBN entry below.';st.className='status show warn';return}
    const supported=await BarcodeDetector.getSupportedFormats();
    const detector=new BarcodeDetector({formats:supported.includes('ean_13')?['ean_13']:supported});
    st.textContent='Scanning… hold the barcode steady.';st.className='status show';
    scanTimer=setInterval(async()=>{
      try{
        const codes=await detector.detect($('#video'));
        const value=codes?.[0]?.rawValue;
        if(value&&/^\d{13}$/.test(value)){
          $('#isbnInput').value=value;stopCamera();lookupISBN(value).catch(e=>{st.textContent=e.message;st.className='status show warn'})
        }
      }catch(e){}
    },650);
  }catch(e){st.textContent='Camera unavailable. Use manual ISBN entry instead.';st.className='status show warn'}
}
function stopCamera(){if(scanTimer)clearInterval(scanTimer);scanTimer=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null}
$('#startScan').addEventListener('click',startCamera);
$('#stopScan').addEventListener('click',stopCamera);

function previewFiles(input,target,setter){
  const arr=[...input.files];setter(arr);const box=$(target);box.innerHTML='';
  arr.forEach(f=>{const img=document.createElement('img');img.className='thumb';img.src=URL.createObjectURL(f);box.appendChild(img)})
}
$('#indexFiles').addEventListener('change',e=>previewFiles(e.target,'#indexThumbs',a=>indexFiles=a));
$('#fullFiles').addEventListener('change',e=>previewFiles(e.target,'#fullThumbs',a=>fullFiles=a));

async function doOCR(files,statusSel,progressSel){
  const st=$(statusSel),bar=$(progressSel),span=bar.querySelector('span');
  bar.classList.remove('hidden');span.style.width='0%';let all='';
  for(let i=0;i<files.length;i++){
    st.textContent=`Reading image ${i+1} of ${files.length}…`;st.className='status show';
    const r=await Tesseract.recognize(files[i],'eng',{logger:m=>{if(m.status==='recognizing text')span.style.width=(((i+(m.progress||0))/files.length)*100)+'%'}});
    all+=(all?'\n\n':'')+r.data.text;
  }
  span.style.width='100%';return all;
}

function parseIndex(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  const out=[], seen=new Set();
  for(let line of lines){
    line=line.replace(/[·•]{2,}/g,' ').replace(/\.{2,}/g,' ').replace(/\s{2,}/g,' ').trim();
    let m=line.match(/^(.*?)[\s\-–—:]+(\d{1,4})(?:\s*)$/) || line.match(/^(.*?)(\d{1,4})$/);
    if(!m) continue;
    let title=m[1].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)'’"&!?]+$/g,'').trim();
    let page=m[2];
    if(title.length<3 || /^(contents|index|page|chapter)$/i.test(title)) continue;
    const key=(title+'|'+page).toLowerCase();
    if(!seen.has(key)){seen.add(key);out.push({title,page})}
  }
  return out;
}
function renderRecipeRows(rows){$('#recipeRows').innerHTML='';rows.forEach(r=>addRecipeRow(r.title,r.page))}
function addRecipeRow(title='',page=''){
  const div=document.createElement('div');div.className='recipe-edit';
  div.innerHTML=`<div class="field"><label>Recipe name</label><input class="rTitle" type="text" value="${esc(title)}"></div>
  <div class="field"><label>Page</label><div class="row"><input class="rPage grow" type="text" value="${esc(page)}"><button class="btn danger small removeRow" type="button">×</button></div></div>`;
  div.querySelector('.removeRow').addEventListener('click',()=>div.remove());$('#recipeRows').appendChild(div);
}
$('#addRecipeRow').addEventListener('click',()=>addRecipeRow());
$('#removeBlankRows').addEventListener('click',()=>$$('.recipe-edit').forEach(r=>{if(!r.querySelector('.rTitle').value.trim())r.remove()}));
$('#reparseIndex').addEventListener('click',()=>renderRecipeRows(parseIndex($('#indexRawText').value)));

$('#runIndexOcr').addEventListener('click',async()=>{
  if(!$('#indexBookSelect').value)return alert('Choose a cookbook first.');
  if(!indexFiles.length)return alert('Choose index or contents page photos first.');
  try{
    const raw=await doOCR(indexFiles,'#indexStatus','#indexProgress');
    $('#indexRawText').value=raw;
    const rows=parseIndex(raw);renderRecipeRows(rows);$('#indexResults').classList.remove('hidden');
    $('#indexStatus').textContent=`Finished. Found ${rows.length} likely recipe entries. Review them before saving.`;
  }catch(e){$('#indexStatus').textContent='OCR failed: '+e.message;$('#indexStatus').className='status show warn'}
});
$('#saveIndex').addEventListener('click',async()=>{
  const bookId=$('#indexBookSelect').value;if(!bookId)return;
  const book=await getBook(bookId);const recipes=await getRecipes();let added=0;
  for(const row of $$('.recipe-edit')){
    const title=row.querySelector('.rTitle').value.trim(),pages=row.querySelector('.rPage').value.trim();
    if(!title) continue;
    const dup=recipes.some(r=>r.bookId===bookId&&r.title.toLowerCase()===title.toLowerCase()&&String(r.pages||'')===pages);
    if(!dup){
      await idbPut('recipes',{id:uid(),bookId,title,pages,country:book?.country||'',cuisine:book?.cuisine||'',tags:[],full:false,favourite:false,wantToCook:false,rating:0,cookedCount:0,cookedDates:[],createdAt:new Date().toISOString()});
      added++;
    }
  }
  alert(`${added} recipe${added===1?'':'s'} saved.`);
  await renderAll();setPage('library');
});

function parseFull(text){
  const clean=String(text||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const lines=clean.split('\n').map(s=>s.trim()).filter(Boolean);
  const title=lines.slice(0,5).find(x=>x.length>3&&x.length<100&&!/\b(ingredients?|method|directions?|instructions?|serves?|prep|cook)\b/i.test(x))||lines[0]||'Untitled recipe';
  const ingIdx=lines.findIndex(x=>/^\s*ingredients?\s*:?\s*$/i.test(x));
  const methodIdx=lines.findIndex(x=>/^\s*(method|directions?|instructions?|preparation)\s*:?\s*$/i.test(x));
  let ingredients='',method='';
  if(ingIdx>=0&&methodIdx>ingIdx){ingredients=lines.slice(ingIdx+1,methodIdx).join('\n');method=lines.slice(methodIdx+1).join('\n')}
  else{
    const likely=lines.filter(x=>/^([•\-–]|\d|½|¼|¾|⅓|⅔)|\b(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|clove|cloves)\b/i.test(x));
    ingredients=likely.join('\n');method=lines.filter(x=>!likely.includes(x)&&x!==title).join('\n');
  }
  const servings=clean.match(/\b(?:serves|makes|yield)\s*:?\s*([^\n]{1,30})/i)?.[1]?.trim()||'';
  return {title,ingredients,method,servings};
}
function fillFull(p,raw){$('#fullTitle').value=p.title||'';$('#fullIngredients').value=p.ingredients||'';$('#fullMethod').value=p.method||'';$('#fullServings').value=p.servings||'';$('#fullRawText').value=raw||'';$('#fullResults').classList.remove('hidden')}
$('#reparseFull').addEventListener('click',()=>fillFull(parseFull($('#fullRawText').value),$('#fullRawText').value));
$('#existingRecipeSelect').addEventListener('change',async()=>{
  const r=await getRecipe($('#existingRecipeSelect').value);if(!r)return;
  $('#fullTitle').value=r.title||'';
  $('#fullPages').value=r.pages||'';
  $('#fullServings').value=r.servings||'';
  $('#fullCountry').value=r.country||'';
  $('#fullCuisine').value=r.cuisine||'';
  $('#fullPrepTime').value=r.prepTime||'';
  $('#fullCookTime').value=r.cookTime||'';
  $('#fullTags').value=(r.tags||[]).join(', ');
  $('#fullIngredients').value=r.ingredients||'';
  $('#fullMethod').value=r.method||'';
  $('#fullNotes').value=r.notes||'';
  $('#fullRawText').value=r.rawText||'';
  $('#fullResults').classList.remove('hidden');
});
$('#manualFullRecipe').addEventListener('click',async()=>{
  const book=await getBook($('#fullBookSelect').value);
  if(!book)return alert('Choose a cookbook first.');
  $('#fullResults').classList.remove('hidden');
  $('#fullCountry').value=$('#fullCountry').value||book.country||'';
  $('#fullCuisine').value=$('#fullCuisine').value||book.cuisine||'';
  $('#fullTitle').focus();
});
$('#runFullOcr').addEventListener('click',async()=>{
  if(!$('#fullBookSelect').value)return alert('Choose a cookbook first.');
  if(!fullFiles.length)return alert('Choose recipe page photos first.');
  try{
    const raw=await doOCR(fullFiles,'#fullStatus','#fullProgress');fillFull(parseFull(raw),raw);$('#fullStatus').textContent='Finished. Check the extracted recipe before saving.';
  }catch(e){$('#fullStatus').textContent='OCR failed: '+e.message;$('#fullStatus').className='status show warn'}
});

function fileToDataURL(file,max=1400,quality=.82){
  return new Promise((resolve,reject)=>{
    if(!file){resolve('');return}
    const img=new Image(),reader=new FileReader();
    reader.onload=()=>{img.onload=()=>{
      const scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',quality));
    };img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)
  });
}
$('#saveFullRecipe').addEventListener('click',async()=>{
  const bookId=$('#fullBookSelect').value,title=$('#fullTitle').value.trim();if(!bookId||!title)return alert('Choose a cookbook and add a title.');
  const existingId=$('#existingRecipeSelect').value;let r=existingId?await getRecipe(existingId):null;
  if(!r) r={id:uid(),bookId,createdAt:new Date().toISOString(),favourite:false,wantToCook:false,rating:0,cookedCount:0,cookedDates:[]};
  let photo=r.photo||'';const pf=$('#dishPhoto').files[0];if(pf) photo=await fileToDataURL(pf);
  Object.assign(r,{bookId,title,pages:$('#fullPages').value.trim(),servings:$('#fullServings').value.trim(),country:$('#fullCountry').value.trim(),cuisine:$('#fullCuisine').value.trim(),prepTime:$('#fullPrepTime').value.trim(),cookTime:$('#fullCookTime').value.trim(),tags:$('#fullTags').value.split(',').map(x=>x.trim()).filter(Boolean),ingredients:$('#fullIngredients').value.trim(),method:$('#fullMethod').value.trim(),notes:$('#fullNotes').value.trim(),rawText:$('#fullRawText').value.trim(),photo,full:true,updatedAt:new Date().toISOString()});
  await idbPut('recipes',r);alert('Full recipe saved.');await renderAll();setPage('library');
});

function parseServingNumber(v){const m=String(v||'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null}
const fracMap={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
function parseLeadingNumber(s){
  s=s.trim();
  for(const [k,v] of Object.entries(fracMap)) if(s.startsWith(k)) return {value:v,len:k.length};
  let m=s.match(/^(\d+)\s+(\d+)\/(\d+)/);if(m)return{value:Number(m[1])+Number(m[2])/Number(m[3]),len:m[0].length};
  m=s.match(/^(\d+)\/(\d+)/);if(m)return{value:Number(m[1])/Number(m[2]),len:m[0].length};
  m=s.match(/^(\d+(?:\.\d+)?)/);if(m)return{value:Number(m[1]),len:m[0].length};
  return null;
}
function niceNumber(n){
  const common=[[.125,'⅛'],[.25,'¼'],[1/3,'⅓'],[.375,'⅜'],[.5,'½'],[.625,'⅝'],[2/3,'⅔'],[.75,'¾'],[.875,'⅞']];
  const whole=Math.floor(n),f=n-whole;
  for(const [v,s] of common) if(Math.abs(f-v)<.03) return (whole?whole+' ':'')+s;
  return Number(n.toFixed(n<10?2:1)).toString();
}
function scaleIngredientLine(line,factor){
  const p=parseLeadingNumber(line);if(!p)return line;
  return niceNumber(p.value*factor)+line.trim().slice(p.len);
}

window.openRecipe=async id=>{
  currentRecipeId=id;const r=await getRecipe(id);const b=await getBook(r.bookId);if(!r)return;
  $('#dlgTitle').textContent=r.title;
  $('#dlgMeta').textContent=[b?.title,r.pages?'p. '+r.pages:'',r.full?'Full recipe saved':'Index entry'].filter(Boolean).join(' · ');
  $('#dlgBadges').innerHTML=[r.country,r.cuisine,...(r.tags||[])].filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
  $('#dlgFav').textContent=r.favourite?'★ Favourite':'☆ Favourite';
  $('#dlgCooked').textContent=`✓ Cooked${r.cookedCount?` (${r.cookedCount})`:''}`;
  $('#dlgWant').textContent=r.wantToCook?'✓ Want to cook':'＋ Want to cook';
  $('#dlgRating').value=String(r.rating||0);
  if(r.photo){$('#dlgPhoto').src=r.photo;$('#dlgPhoto').classList.remove('hidden')}else $('#dlgPhoto').classList.add('hidden');
  if(r.full){
    const base=parseServingNumber(r.servings);$('#scaleControls').classList.toggle('hidden',!base);if(base){$('#scaleFrom').value=base;$('#scaleTo').value=base}
    $('#dlgBody').innerHTML=renderFullRecipeBody(r,1);
  }else{
    $('#scaleControls').classList.add('hidden');
    $('#dlgBody').innerHTML=`<p>This recipe is indexed in your cookbook library. ${r.pages?`Open the physical book at <strong>page ${esc(r.pages)}</strong>.`:''}</p><p class="muted">Use the Full recipe tab if you want ingredients, method, notes and serving scaling stored here too.</p>`;
  }
  $('#recipeDialog').showModal();
}
function renderFullRecipeBody(r,factor=1){
  const ing=(r.ingredients||'').split('\n').map(x=>factor===1?x:scaleIngredientLine(x,factor)).join('\n');
  return `<h3>Ingredients</h3><div class="recipe-block">${esc(ing)}</div>
  <h3>Method</h3><div class="recipe-block">${esc(r.method||'')}</div>
  ${(r.servings||r.prepTime||r.cookTime)?`<p>${r.servings?`<strong>Original servings:</strong> ${esc(r.servings)}&nbsp;&nbsp;`:''}${r.prepTime?`<strong>Prep:</strong> ${esc(r.prepTime)}&nbsp;&nbsp;`:''}${r.cookTime?`<strong>Cook:</strong> ${esc(r.cookTime)}`:''}</p>`:''}
  ${r.notes?`<h3>Your notes</h3><div class="recipe-block">${esc(r.notes)}</div>`:''}
  ${(r.cookedDates||[]).length?`<p class="muted small">Cooked: ${r.cookedDates.slice(-5).reverse().map(d=>new Date(d).toLocaleDateString()).join(', ')}</p>`:''}`;
}
$('#closeDialog').addEventListener('click',()=>$('#recipeDialog').close());
$('#dlgFav').addEventListener('click',async()=>{const r=await getRecipe(currentRecipeId);r.favourite=!r.favourite;await idbPut('recipes',r);await openRecipe(r.id);await renderLibrary()});
$('#dlgCooked').addEventListener('click',async()=>{const r=await getRecipe(currentRecipeId);r.cookedCount=(r.cookedCount||0)+1;r.cookedDates=[...(r.cookedDates||[]),new Date().toISOString()];await idbPut('recipes',r);await openRecipe(r.id);await renderLibrary()});
$('#dlgWant').addEventListener('click',async()=>{const r=await getRecipe(currentRecipeId);r.wantToCook=!r.wantToCook;await idbPut('recipes',r);await openRecipe(r.id);await renderLibrary()});
$('#dlgPrint').addEventListener('click',async()=>{
  const r=await getRecipe(currentRecipeId), b=await getBook(r.bookId);
  if(!r)return;
  const w=window.open('','_blank');
  const ingredients=esc(r.ingredients||'').replace(/\n/g,'<br>');
  const method=esc(r.method||'').replace(/\n/g,'<br>');
  const notes=esc(r.notes||'').replace(/\n/g,'<br>');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    body{font:16px/1.5 system-ui;max-width:760px;margin:35px auto;padding:0 22px;color:#222}
    h1{margin-bottom:4px} .meta{color:#666;margin-bottom:20px}.block{white-space:normal;background:#f5f2eb;padding:16px;border-radius:10px}
    img{max-width:100%;max-height:340px;object-fit:cover;border-radius:10px}
    @media print{button{display:none}body{margin:0}}
  </style></head><body>
  <h1>${esc(r.title)}</h1><div class="meta">${esc(b?.title||'')}${r.pages?' · p. '+esc(r.pages):''}${r.country?' · '+esc(r.country):''}${r.cuisine?' · '+esc(r.cuisine):''}</div>
  ${r.photo?`<img src="${r.photo}" alt="">`:''}
  ${(r.servings||r.prepTime||r.cookTime)?`<p>${r.servings?`<strong>Servings:</strong> ${esc(r.servings)} &nbsp;`:''}${r.prepTime?`<strong>Prep:</strong> ${esc(r.prepTime)} &nbsp;`:''}${r.cookTime?`<strong>Cook:</strong> ${esc(r.cookTime)}`:''}</p>`:''}
  ${r.full?`<h2>Ingredients</h2><div class="block">${ingredients}</div><h2>Method</h2><div class="block">${method}</div>`:`<p>Indexed recipe${r.pages?' on page '+esc(r.pages):''}.</p>`}
  ${notes?`<h2>Notes</h2><div class="block">${notes}</div>`:''}
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
});

$('#dlgRating').addEventListener('change',async()=>{const r=await getRecipe(currentRecipeId);r.rating=Number($('#dlgRating').value);await idbPut('recipes',r);await renderLibrary()});
$('#applyScale').addEventListener('click',async()=>{const r=await getRecipe(currentRecipeId);const from=Number($('#scaleFrom').value),to=Number($('#scaleTo').value);if(from>0&&to>0)$('#dlgBody').innerHTML=renderFullRecipeBody(r,to/from)});

window.deleteBook=async id=>{
  const b=await getBook(id);if(!b||!confirm(`Delete "${b.title}" and all recipes belonging to it?`))return;
  const recipes=await getRecipes();
  for(const r of recipes.filter(x=>x.bookId===id))await idbDelete('recipes',r.id);
  await idbDelete('books',id);await renderAll();
};

$('#findCookable').addEventListener('click',async()=>{
  const pantry=$('#pantryInput').value.split(/\n|,/).map(x=>x.trim().toLowerCase()).filter(Boolean);
  const recipes=(await getRecipes()).filter(r=>r.full&&r.ingredients);
  if(!pantry.length){$('#cookableResults').innerHTML='<div class="empty">Add some ingredients first.</div>';return}
  const ranked=recipes.map(r=>{
    const lines=r.ingredients.split('\n').map(x=>x.toLowerCase()).filter(Boolean);
    const matched=lines.filter(line=>pantry.some(p=>line.includes(p))).length;
    return {r,matched,total:lines.length,score:lines.length?matched/lines.length:0}
  }).filter(x=>x.matched>0).sort((a,z)=>z.score-a.score||z.matched-a.matched);
  $('#cookableResults').innerHTML=ranked.length?ranked.slice(0,20).map(x=>`<div class="result-card"><strong>${esc(x.r.title)}</strong><div class="score">${Math.round(x.score*100)}% ingredient-line match</div><div class="muted small">${x.matched} of ${x.total} lines matched</div><button class="btn ghost small top-gap" onclick="openRecipe('${x.r.id}')">Open</button></div>`).join(''):'<div class="empty">No useful matches yet.</div>';
});

async function renderShoppingPicker(){
  const recipes=(await getRecipes()).filter(r=>r.full&&r.ingredients).sort((a,z)=>(a.title||'').localeCompare(z.title||''));
  $('#shoppingRecipePicker').innerHTML=recipes.length?recipes.map(r=>{
    const base=parseServingNumber(r.servings)||2;
    return `<div class="shopping-pick"><input type="checkbox" class="shopCheck" value="${r.id}"><div><strong>${esc(r.title)}</strong><div class="muted small">${r.servings?'Original: '+esc(r.servings):'Assumes 2 servings if unknown'}</div></div><input class="shopServings" data-id="${r.id}" type="number" min="1" step="1" value="${base}"></div>`
  }).join(''):'<div class="empty">Digitise some full recipes first.</div>';
}
$('#generateShopping').addEventListener('click',async()=>{
  const checked=$$('.shopCheck:checked');const blocks=[];
  for(const c of checked){
    const r=await getRecipe(c.value);const base=parseServingNumber(r.servings)||2;const wanted=Number($(`.shopServings[data-id="${r.id}"]`).value)||base;const factor=wanted/base;
    const lines=(r.ingredients||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>scaleIngredientLine(x,factor));
    blocks.push(`${r.title} (${wanted} servings)\n${lines.map(x=>'☐ '+x).join('\n')}`);
  }
  $('#shoppingOutput').value=blocks.join('\n\n');
});
$('#copyShopping').addEventListener('click',async()=>{await navigator.clipboard.writeText($('#shoppingOutput').value);alert('Shopping list copied.')});

$('#exportJson').addEventListener('click',async()=>{
  const payload={version:3,exportedAt:new Date().toISOString(),books:await getBooks(),recipes:await getRecipes()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='my-cookbook-library-backup.json';a.click();URL.revokeObjectURL(a.href);
});
$('#importJson').addEventListener('click',async()=>{
  const f=$('#importFile').files[0];if(!f)return alert('Choose a backup file first.');
  const d=JSON.parse(await f.text());if(!Array.isArray(d.books)||!Array.isArray(d.recipes))return alert('This is not a valid backup.');
  await idbClear('books');await idbClear('recipes');
  for(const b of d.books)await idbPut('books',b);
  for(const r of d.recipes)await idbPut('recipes',r);
  await renderAll();alert('Backup restored.');
});
$('#wipeData').addEventListener('click',async()=>{if(confirm('Delete every cookbook, recipe, note and photo from this app on this device?')){await idbClear('books');await idbClear('recipes');await renderAll()}});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});

(async function init(){
  dbConn=await openDB();
  await renderAll();
})();
