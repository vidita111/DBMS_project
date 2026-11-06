const $=s=>document.querySelector(s);


let S={page:'home',role:'',fileName:'',sel:new Set(),rq:'',rs:'cap',q:'',sort:'',filt:'-',sd:'',st:'',se:''};
let R,E,BR,SUB,INV_SEED,NAMES;
async function loadSeed(){const r=await fetch('data/seed.json');if(!r.ok)throw new Error('seed.json '+r.status);const d=await r.json();
 R=d.rooms.map(x=>[x.no,x.floor,x.block,x.seats]);E=d.exams.map(x=>[x.date,x.time,x.sem,x.branch,x.slot,x.subject]);BR=d.branches;SUB=d.subjects;INV_SEED=d.invigilators.map(x=>[x.id,x.name,x.dept]);NAMES=d.student_names}
const SCHEMA_T=`
CREATE TABLE room(no TEXT PRIMARY KEY,floor INTEGER NOT NULL CHECK(floor BETWEEN 0 AND 12),block TEXT NOT NULL,seats INTEGER NOT NULL CHECK(seats>0));
CREATE TABLE student(roll TEXT PRIMARY KEY,name TEXT NOT NULL,branch TEXT NOT NULL,sem INTEGER NOT NULL);
CREATE INDEX idx_student_branch ON student(branch,sem);
CREATE TABLE invigilator(id TEXT PRIMARY KEY,name TEXT NOT NULL,dept TEXT NOT NULL);
CREATE TABLE exam(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,time TEXT NOT NULL CHECK(time IN('FN','AN')),sem INTEGER NOT NULL,branch TEXT NOT NULL,slot TEXT NOT NULL,subject TEXT NOT NULL,UNIQUE(date,time,sem,branch));
CREATE TABLE seat_alloc(date TEXT,time TEXT,room TEXT REFERENCES room(no),seat TEXT,roll TEXT REFERENCES student(roll),sub TEXT,PRIMARY KEY(date,time,room,seat),UNIQUE(date,time,roll));
CREATE TABLE duty(date TEXT,time TEXT,room TEXT REFERENCES room(no),inv TEXT REFERENCES invigilator(id),PRIMARY KEY(date,time,room));
CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT DEFAULT (datetime('now','localtime')),action TEXT,detail TEXT);`;
const SCHEMA_X=`
CREATE TRIGGER trg_room_ins AFTER INSERT ON room BEGIN INSERT INTO audit(action,detail) VALUES('ROOM_ADD','Room '||NEW.no||' ('||NEW.seats||' seats)'); END;
CREATE TRIGGER trg_room_del AFTER DELETE ON room BEGIN INSERT INTO audit(action,detail) VALUES('ROOM_DELETE','Room '||OLD.no); END;
CREATE TRIGGER trg_exam_ins AFTER INSERT ON exam BEGIN INSERT INTO audit(action,detail) VALUES('EXAM_ADD',NEW.subject||' '||NEW.branch||' on '||NEW.date||' '||NEW.time); END;
CREATE TRIGGER trg_exam_del AFTER DELETE ON exam BEGIN INSERT INTO audit(action,detail) VALUES('EXAM_DELETE',OLD.subject||' '||OLD.branch||' on '||OLD.date); END;
CREATE TRIGGER trg_capacity BEFORE INSERT ON seat_alloc WHEN (SELECT COUNT(*) FROM seat_alloc WHERE date=NEW.date AND time=NEW.time AND room=NEW.room)>=(SELECT seats FROM room WHERE no=NEW.room) BEGIN SELECT RAISE(ABORT,'Room capacity exceeded for '||NEW.room); END;
CREATE VIEW v_student_slip AS SELECT a.roll,s.name,a.sub,a.date,a.time,a.room,r.block,r.floor,a.seat FROM seat_alloc a JOIN student s ON s.roll=a.roll JOIN room r ON r.no=a.room;
CREATE VIEW v_duty_roster AS SELECT d.date,d.time,d.room,i.id,i.name,(SELECT COUNT(*) FROM seat_alloc a WHERE a.date=d.date AND a.time=d.time AND a.room=d.room) AS students FROM duty d JOIN invigilator i ON i.id=d.inv;
CREATE VIEW v_hall_utilization AS SELECT a.date,a.time,a.room,r.seats AS capacity,COUNT(*) AS occupied,ROUND(100.0*COUNT(*)/r.seats,1) AS pct FROM seat_alloc a JOIN room r ON r.no=a.room GROUP BY a.date,a.time,a.room;`;
let DB=null;
const rows=(q,a)=>{const st=DB.prepare(q);st.bind(a||[]);const o=[];while(st.step())o.push(st.getAsObject());st.free();return o};
const col=(q,a)=>rows(q,a).map(r=>Object.values(r)[0]);
let pt=0;function persist(){clearTimeout(pt);pt=setTimeout(()=>{try{const u=DB.export();let b='';for(let i=0;i<u.length;i+=8192)b+=String.fromCharCode.apply(null,u.subarray(i,i+8192));localStorage.setItem('esa_db',btoa(b))}catch(e){}},300)}
const run=(q,a)=>{DB.run(q,a);persist()};
function seed(){DB.exec(SCHEMA_T);DB.run('BEGIN');
 R.forEach(r=>DB.run('INSERT INTO room VALUES(?,?,?,?)',r));
 E.forEach(e=>DB.run('INSERT INTO exam(date,time,sem,branch,slot,subject) VALUES(?,?,?,?,?,?)',[e[0],e[1],e[2],e[3],e[4],e[5]]));
 INV_SEED.forEach(i=>DB.run('INSERT INTO invigilator VALUES(?,?,?)',i));
 const FN=NAMES.first,LN=NAMES.last;
 const st=DB.prepare('INSERT INTO student VALUES(?,?,?,?)');
 [3,7].forEach(sem=>BR.forEach((b,k)=>{for(let n=1;n<=60;n++)st.run(['MUT'+(sem===3?'21':'19')+b+String(n).padStart(3,'0'),FN[(n*7+k+sem)%20]+' '+LN[(n*3+k)%10],b,sem])}));
 st.free();DB.run('COMMIT');DB.exec(SCHEMA_X)}
loadSeed().then(()=>initSqlJs({locateFile:f=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/'+f})).then(SQL=>{
 let saved=null;try{saved=localStorage.getItem('esa_db')}catch(e){}
 if(saved){try{DB=new SQL.Database(Uint8Array.from(atob(saved),c=>c.charCodeAt(0)));DB.run('PRAGMA foreign_keys=ON');rows("SELECT 1 FROM v_hall_utilization LIMIT 1")}catch(e){DB=null}}
 if(!DB){DB=new SQL.Database();DB.run('PRAGMA foreign_keys=ON');seed();persist()}
 INV=rows('SELECT id,name,dept FROM invigilator ORDER BY id')}).catch(()=>{$('#le').textContent=location.protocol==='file:'?'Open this through a local server (see README), not by double-clicking.':'Could not load the database or data/seed.json. Check your connection and reload.'});
Object.defineProperties(S,{
 rooms:{get:()=>rows('SELECT no,floor,block,seats FROM room ORDER BY rowid')},
 exams:{get:()=>rows('SELECT id,date,time,sem,branch AS br,slot,subject AS sub FROM exam ORDER BY id')},
 students:{get:()=>col('SELECT roll FROM student')},
 plans:{get:()=>rows('SELECT DISTINCT date,time FROM seat_alloc ORDER BY date,time').map(k=>{const res=[];rows('SELECT room,seat,roll,sub FROM seat_alloc WHERE date=? AND time=? ORDER BY room,rowid',[k.date,k.time]).forEach(x=>{let r=res.find(y=>y.room===x.room);if(!r)res.push(r={room:x.room,rows:[]});r.rows.push({seat:x.seat,sub:x.sub,roll:x.roll})});return{date:k.date,time:k.time,res,duty:rows('SELECT room,inv FROM duty WHERE date=? AND time=?',[k.date,k.time])}})}});

const fmt=d=>d.split('-').reverse().join('/');
const opt=(a,v)=>a.map(x=>`<option${String(x)===String(v)?' selected':''}>${x}</option>`).join('');
const NAV=[['home','Home'],['rooms','Manage Rooms'],['exams','University Exams'],['alloc','Seat Allocation'],['charts','Seating Charts'],['db','Database']];
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function toast(m,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;t.setAttribute('role','status');document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
/* login */
let signup=false;
$('#eye').onclick=()=>{const p=$('#p');p.type=p.type==='password'?'text':'password'};
function mode(v){signup=v;$('#lt').textContent=signup?'SIGN UP':'LOG IN';$('#lb').textContent=signup?'Sign Up':'Sign In';$('#lq').textContent=signup?'Already have an account?':'Don’t have an account?';$('#ls').textContent=signup?'Log In':'Sign Up';$('#le').textContent=''}
$('#ls').onclick=()=>mode(!signup);
$('#role').onchange=e=>{const pt=e.target.value==='portal';$('#lf').classList.toggle('pt',pt);if(pt)signup=false;mode(signup);if(pt)$('#lb').textContent='Continue'};
$('#lf').onsubmit=e=>{e.preventDefault();if(!DB){$('#le').textContent='Database is still loading. Try again in a moment.';return}if($('#role').value==='portal'){S.role='portal';$('#un').textContent='PORTAL';$('#login').style.display='none';$('#app').classList.add('on');go('portal');return}S.role='admin';const u=$('#u').value.trim(),p=$('#p').value;
 if(!u||!p){$('#le').textContent='Enter a username and password.';return}
 const users=store.get('esa_users')||{};
 if(signup){if(users[u]){$('#le').textContent='That username is taken.';return}users[u]=p;store.set('esa_users',users);mode(false);toast('Account created. Sign in to continue.');return}
 if(users[u]&&users[u]!==p){$('#le').textContent='Incorrect password.';return}
 $('#un').textContent=u.toUpperCase();$('#login').style.display='none';$('#app').classList.add('on');go('home')};
$('#out').onclick=()=>{$('#app').classList.remove('on');$('#login').style.display='grid';$('#p').value=''};
$('#dots').onclick=()=>$('#side').classList.toggle('hide');
function go(p){S.page=p;$('#nav').innerHTML=(S.role==='portal'?[['portal','Seating Portal']]:NAV).map(n=>`<button class="${n[0]===p?'act':''}" data-p="${n[0]}">${n[1]}</button>`).join('');
 $('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>go(b.dataset.p));
 $('#main').innerHTML=PAGES[p]();(INIT[p]||(()=>{}))()}
const total=()=>S.rooms.reduce((a,r)=>a+r.seats,0);
let INV=[];
const COL=['#2f7df6','#e5483b','#17a35a','#d9920c','#8e5cf0','#0f9fb5','#d6458f'];const sc=s=>COL[Math.max(0,SUB.indexOf(s))%COL.length];
function grid(rows,cap,hl){const n=Math.max(cap,rows.length);let h='<div class="gw"><div class="g'+(hl?' dim':'')+'">';
 for(let i=0;i<n;i++){const x=rows[i];h+=x?`<i class="s${x.roll===hl?' hl':''}" style="background:${sc(x.sub)}" title="${x.seat} · ${x.roll} · ${x.sub}">${x.roll.slice(-3)}</i>`:'<i class="s v" title="Vacant"></i>'}
 return h+'</div></div>'}
function roomView(p,no,hl){const r=p.res.find(x=>x.room===no);if(!r)return{g:'',s:''};const rm=S.rooms.find(x=>x.no===no)||{seats:r.rows.length},cap=rm.seats||r.rows.length;
 const subs=[...new Set(r.rows.map(x=>x.sub))],d=p.duty.find(x=>x.room===no),inv=INV.find(i=>d&&i.id===d.inv)||{name:'Unassigned'};
 return{g:grid(r.rows,cap,hl)+`<div class="leg">${subs.map(x=>`<span><b style="background:${sc(x)}"></b>${x}</span>`).join('')}<span><b class="v"></b>Vacant</span></div>`,
 s:`<h3>Hall ${no}</h3><p>Total capacity : ${cap}</p><p>Occupied : ${r.rows.length}</p><p>Vacant : ${Math.max(0,cap-r.rows.length)}</p><p>Occupancy : ${Math.round(r.rows.length/cap*100)}%</p><p>Courses : ${subs.length}</p><p>Invigilator : ${inv.name}</p>`}}
function savePlan(res){DB.run('BEGIN');try{DB.run('DELETE FROM seat_alloc WHERE date=? AND time=?',[S.sd,S.st]);DB.run('DELETE FROM duty WHERE date=? AND time=?',[S.sd,S.st]);
 const ins=DB.prepare('INSERT INTO seat_alloc VALUES(?,?,?,?,?,?)');try{res.forEach(r=>r.rows.forEach(x=>ins.run([S.sd,S.st,r.room,x.seat,x.roll,x.sub])))}finally{ins.free()}
 const load={};rows('SELECT inv,COUNT(*) AS n FROM duty GROUP BY inv').forEach(r=>load[r.inv]=r.n);const used=new Set();
 res.forEach(r=>{const v=INV.filter(i=>!used.has(i.id)).sort((a,b)=>(load[a.id]||0)-(load[b.id]||0))[0]||INV[0];used.add(v.id);load[v.id]=(load[v.id]||0)+1;DB.run('INSERT INTO duty VALUES(?,?,?,?)',[S.sd,S.st,r.room,v.id])});
 DB.run('INSERT INTO audit(action,detail) VALUES(?,?)',['SEAT_PLAN',res.reduce((a,r)=>a+r.rows.length,0)+' students in '+res.length+' halls on '+S.sd+' '+S.st]);DB.run('COMMIT');persist();
 toast('Plan saved to the database. Students and invigilators can now look it up in the portal.')}catch(err){DB.run('ROLLBACK');toast('Plan not saved, nothing was changed: '+err.message,1)}}
function slip(h){const rm=S.rooms.find(x=>x.no===h.r.room)||{block:'-',floor:'-',seats:60},i=h.r.rows.indexOf(h.x),f=(l,v)=>`<div><small>${l}</small><b>${v}</b></div>`;
 return `<div class="slip"><div class="sh"><b>Examination seat slip</b><span>${fmt(h.p.date)} · ${h.p.time}</span></div><div class="sg">${f('Student',h.name||'-')}${f('Roll number',h.x.roll)}${f('Course',h.x.sub)}${f('Hall',h.r.room)}${f('Building',rm.block)}${f('Floor',rm.floor)}${f('Row',String.fromCharCode(65+Math.floor(i/18)))}${f('Column',i%18+1)}${f('Seat',h.x.seat)}</div>${grid(h.r.rows,rm.seats||h.r.rows.length,h.x.roll)}<p style="color:var(--mut);margin:10px 0 14px">Your seat is outlined in the hall plan.</p><button class="btn blue noprint" onclick="window.print()">Print seat slip</button></div>`}
const TR='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>';
const PAGES={
home:()=>`<h2>Welcome, ${$('#un').textContent}</h2><div class="cards"><div class="card"><b>${S.rooms.length}</b>Exam rooms</div><div class="card"><b>${total()}</b>Seats available</div><div class="card"><b>${S.exams.length}</b>Exams scheduled</div><div class="card"><b>${S.students.length||'None'}</b>Students in database</div></div><p style="color:var(--mut)">Add rooms, upload examinee details and schedule exams, then arrange seats from Seat Allocation.</p>`,
rooms:()=>`<h2>Add Room</h2><form class="row" id="rf"><label class="f">Room No<input id="rn" placeholder="M101" required></label><label class="f">Floor No<select id="rfl">${opt([1,2,3,4,5,6])}</select></label><label class="f">Block<select id="rb">${opt(['M-George','Ramanujan'])}</select></label><label class="f">Available Seats<input id="rse" type="number" min="1" placeholder="30" required></label><button class="btn blue">Add</button></form>
<h2 style="margin-top:22px">Available Rooms</h2><div class="tbl"><div class="tools"><input type="text" id="q" placeholder="Search" aria-label="Search rooms"><span>Sort By :</span><select class="sel" id="so">${opt(['Entries','Room No','Floor No','Seats'])}</select><span>Filter By :</span><select class="sel" id="fi">${opt(['-','M-George','Ramanujan'])}</select></div>
<div class="scroll"><table><thead><tr><th>Room No</th><th>Floor No</th><th>Block</th><th>Available Seats</th><th></th></tr></thead><tbody id="rt"></tbody></table></div></div>
<div class="foot"><span id="rtot"></span><div class="acts"><button class="btn gray" id="rclr">Clear all</button><button class="btn green pill" id="rnx">Next</button></div></div>`,
exams:()=>`<div class="row" style="align-items:center"><label class="f" style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase">Select Semester<select class="sel" id="sem" style="font-size:14px;text-transform:none">${opt([1,2,3,4,5,6,7,8].map(n=>'Semester '+n),'Semester 3')}</select></label>
<label class="f" style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase;margin-left:auto">Examinee Details<input type="file" id="file" accept=".xlsx,.xls,.csv" style="min-width:0;font-size:13px;background:#fff;border-radius:6px;padding:3px"></label><button class="btn green pill" id="up">Upload file</button></div>
<h2 style="margin-top:20px">Add Slots</h2><form class="row" id="ef"><label class="f">Date<input type="date" id="ed" required value="2023-07-20"></label><label class="f">Time<select id="et">${opt(['FN','AN'])}</select></label><label class="f">Branches<select id="eb">${opt(BR)}</select></label><label class="f">Slot<select id="es">${opt(['A','B','C','D','E','F'])}</select></label><label class="f">Subject<select id="esu">${opt(SUB)}</select></label><button class="btn blue">Add</button></form>
<h2 style="margin-top:20px">Exam Schedules</h2><div class="tbl"><div class="scroll"><table><thead><tr><th>Date</th><th>Time</th><th>Semester</th><th>Branch</th><th>Slot</th><th>Subject</th><th></th></tr></thead><tbody id="et2"></tbody></table></div></div>
<div class="foot"><span id="ecnt"></span><div class="acts"><button class="btn gray" id="eclr">Clear all</button><button class="btn green pill" id="enx">Next</button></div></div>`,
alloc:()=>{const ds=[...new Set(S.exams.map(e=>e.date))];if(!S.sd||!ds.includes(S.sd))S.sd=ds[0]||'';
return `<div class="row" style="align-items:center;gap:26px"><label class="f" style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase">Select Date<select class="sel" id="ad">${ds.map(d=>`<option value="${d}"${d===S.sd?' selected':''}>${fmt(d)}</option>`).join('')}</select></label><label class="f" style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase">Select Time<select class="sel" id="at"></select></label><label class="f" style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase">Exams Scheduled<select class="sel" id="ae"></select></label></div>
<h2 style="margin-top:22px">Select Exam Halls</h2><div class="split"><div class="tbl"><div class="tools"><input type="text" id="aq" placeholder="Search" aria-label="Search rooms"><span>Sort By :</span><select class="sel" id="ao"><option value="cap">Increasing capacity</option><option value="dec">Decreasing capacity</option><option value="no">Room No</option></select></div><div class="chips" id="chips"></div></div>
<div class="stat"><h3>STATISTICS</h3><p id="s1"></p><p id="s2"></p><p id="s3"></p><p id="s4"></p><p id="s5"></p></div></div>
<div class="foot" style="justify-content:flex-end"><div class="acts"><button class="btn green pill" id="arr">Arrange</button><button class="btn navy" id="mail">Receive mail</button></div></div>`}};
const LBL='style="flex-direction:row;align-items:center;gap:14px;font-size:18px;text-transform:uppercase"';
PAGES.charts=()=>S.plans.length?`<div class="row" style="align-items:center;gap:26px"><label class="f" ${LBL}>Session<select class="sel" id="cp">${S.plans.map((q,i)=>`<option value="${i}">${fmt(q.date)} ${q.time}</option>`).join('')}</select></label><label class="f" ${LBL}>Hall<select class="sel" id="cr"></select></label></div><h2 style="margin-top:22px">Hall seating chart</h2><div class="split"><div class="tbl" id="cg"></div><div class="stat" id="cs"></div></div>`:`<h2>Seating charts</h2><div class="tbl"><div class="empty">No seating plans yet. Arrange seats in Seat Allocation first.</div></div>`;
PAGES.portal=()=>`<h2>Seating portal</h2><div class="tabs"><button class="tab on" data-t="s">Student seat lookup</button><button class="tab" data-t="i">Invigilator duty</button></div><div id="pb"></div>`;
PAGES.db=()=>`<h2>Database (SQLite)</h2><div class="cards" id="dbc"></div><h2>Run a query</h2><form id="qf"><textarea id="qt" rows="3" aria-label="SQL query" style="width:100%;border-radius:12px;border:2px solid transparent;padding:10px 12px;font:13px ui-monospace,monospace;background:#fff;color:#222">SELECT * FROM v_hall_utilization;</textarea><div class="row" style="margin:10px 0;align-items:center"><button class="btn blue">Run query</button><span style="color:var(--mut);font-size:13px">Views: v_student_slip, v_duty_roster, v_hall_utilization</span><button type="button" class="btn gray" id="rst" style="margin-left:auto">Reset database</button></div></form><div class="tbl" id="qr"></div><h2 style="margin-top:22px">Audit log (written by triggers)</h2><div class="tbl" id="dba"></div>`;
const INIT={rooms(){
 const draw=()=>{let l=S.rooms.map((r,i)=>({...r,i})).filter(r=>(S.filt==='-'||r.block===S.filt)&&(r.no+r.block).toLowerCase().includes(S.q.toLowerCase()));
  if(S.sort==='Room No')l.sort((a,b)=>a.no.localeCompare(b.no,0,{numeric:true}));if(S.sort==='Floor No')l.sort((a,b)=>a.floor-b.floor);if(S.sort==='Seats')l.sort((a,b)=>a.seats-b.seats);
  $('#rt').innerHTML=l.length?l.map(r=>`<tr><td>${r.no}</td><td>${r.floor}</td><td>${r.block}</td><td>${r.seats}</td><td><button class="del" data-i="${r.i}" aria-label="Delete ${r.no}">${TR}</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No rooms match. Add a room above.</td></tr>';
  $('#rtot').textContent='Total Seats Available: '+total();$('#rt').querySelectorAll('.del').forEach(b=>b.onclick=()=>{const r=S.rooms[+b.dataset.i];try{run('DELETE FROM room WHERE no=?',[r.no]);S.sel.delete(r.no)}catch(err){toast(err.message,1)}draw()})};
 $('#q').oninput=e=>{S.q=e.target.value;draw()};$('#so').onchange=e=>{S.sort=e.target.value;draw()};$('#fi').onchange=e=>{S.filt=e.target.value;draw()};
 $('#rf').onsubmit=e=>{e.preventDefault();const no=$('#rn').value.trim(),s=+$('#rse').value;
  if(S.rooms.some(r=>r.no.toLowerCase()===no.toLowerCase())){toast('Room '+no+' already exists.',1);return}
  if(s<1){toast('Seats must be at least 1.',1);return}
  try{run('INSERT INTO room VALUES(?,?,?,?)',[no,+$('#rfl').value,$('#rb').value,s])}catch(err){toast(err.message,1);return}$('#rn').value='';$('#rse').value='';draw();toast('Room '+no+' added.')};
 $('#rclr').onclick=()=>{if(confirm('Remove all rooms?')){try{run('DELETE FROM room');S.sel.clear()}catch(err){toast(err.message,1)}draw()}};$('#rnx').onclick=()=>go('exams');draw()},
exams(){
 const draw=()=>{$('#et2').innerHTML=S.exams.length?S.exams.map((x,i)=>`<tr><td>${fmt(x.date)}</td><td>${x.time}</td><td>${x.sem}</td><td>${x.br}</td><td>${x.slot}</td><td>${x.sub}</td><td><button class="del" data-i="${i}" aria-label="Delete exam">${TR}</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No exams scheduled. Add a slot above.</td></tr>';
  $('#ecnt').textContent='No of Exams scheduled : '+S.exams.length+(S.fileName?'  ·  '+S.fileName+' ('+S.students.length+' students)':'');
  $('#et2').querySelectorAll('.del').forEach(b=>b.onclick=()=>{run('DELETE FROM exam WHERE id=?',[S.exams[+b.dataset.i].id]);draw()})};
 $('#ef').onsubmit=e=>{e.preventDefault();const x={date:$('#ed').value,time:$('#et').value,sem:+$('#sem').value.split(' ')[1],br:$('#eb').value,slot:$('#es').value,sub:$('#esu').value};
  if(S.exams.some(o=>o.date===x.date&&o.time===x.time&&o.br===x.br&&o.sem===x.sem)){toast('That branch already has an exam in this session.',1);return}
  try{run('INSERT INTO exam(date,time,sem,branch,slot,subject) VALUES(?,?,?,?,?,?)',[x.date,x.time,x.sem,x.br,x.slot,x.sub])}catch(err){toast(err.message,1);return}draw();toast('Exam added.')};
 $('#up').onclick=()=>{const f=$('#file').files[0];if(!f){toast('Choose a file first.',1);return}
  const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(ev.target.result,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
   const ids=rows.flat().map(v=>String(v||'').trim()).filter(v=>/^[A-Za-z]+\d{2}[A-Za-z]{2}\d+$/.test(v));let n=0;DB.run('BEGIN');try{const sm=+$('#sem').value.split(' ')[1];ids.forEach(v=>{const b=v.match(/^[A-Za-z]+\d{2}([A-Za-z]{2})/)[1].toUpperCase();DB.run('INSERT OR IGNORE INTO student VALUES(?,?,?,?)',[v.toUpperCase(),'Imported student',b,sm]);n+=DB.getRowsModified()});DB.run('COMMIT');persist()}catch(x){DB.run('ROLLBACK');throw x}S.fileName=f.name;draw();toast(n+' new students imported.')}catch(err){toast('Could not read that file.',1)}};rd.readAsArrayBuffer(f)};
 $('#eclr').onclick=()=>{if(confirm('Remove all exams?')){run('DELETE FROM exam');draw()}};$('#enx').onclick=()=>go('alloc');draw()},
alloc(){
 const exs=()=>S.exams.filter(e=>e.date===S.sd&&e.time===S.st),parts=e=>e?col('SELECT roll FROM student WHERE branch=? AND sem=? ORDER BY roll',[e.br,e.sem]):[];
 const lab=e=>`S${e.sem}-${e.br}-${e.slot}`;
 const times=()=>{const t=[...new Set(S.exams.filter(e=>e.date===S.sd).map(e=>e.time))];if(!t.includes(S.st))S.st=t[0]||'';$('#at').innerHTML=opt(t,S.st)};
 const exSel=()=>{const l=exs();$('#ae').innerHTML='<option value="*">All exams</option>'+l.map(e=>`<option value="${lab(e)}"${lab(e)===S.se?' selected':''}>${lab(e)}</option>`).join('')};
 const cur=()=>S.se&&S.se!=='*'?exs().filter(e=>lab(e)===S.se):exs();
 const chips=()=>{let l=S.rooms.filter(r=>r.no.toLowerCase().includes(S.rq.toLowerCase()));l.sort((a,b)=>S.rs==='dec'?b.seats-a.seats:S.rs==='no'?a.no.localeCompare(b.no,0,{numeric:true}):a.seats-b.seats);
  $('#chips').innerHTML=l.length?l.map(r=>`<button class="chip${S.sel.has(r.no)?' on':''}" data-n="${r.no}" aria-pressed="${S.sel.has(r.no)}">${r.no}<span>${r.seats}</span></button>`).join(''):'<div class="empty">No rooms. Add rooms in Manage Rooms.</div>';
  $('#chips').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{S.sel.has(c.dataset.n)?S.sel.delete(c.dataset.n):S.sel.add(c.dataset.n);chips();stats()})};
 const picked=()=>S.rooms.filter(r=>S.sel.has(r.no));
 const stats=()=>{$('#s1').textContent='Total Rooms : '+S.rooms.length;$('#s2').textContent='Available Seats : '+total();$('#s3').textContent='Rooms Selected : '+picked().length;$('#s4').textContent='Seats Selected : '+picked().reduce((a,r)=>a+r.seats,0);$('#s5').textContent='Total Participants : '+cur().reduce((a,e)=>a+parts(e).length,0)};
 const build=()=>{const list=cur();if(!list.length){toast('No exams scheduled for this date and time.',1);return null}
  const rows=[];list.forEach(e=>parts(e).forEach(r=>rows.push({sub:e.sub,roll:r})));
  const rooms=picked(),cap=rooms.reduce((a,r)=>a+r.seats,0);
  if(!rooms.length){toast('Select at least one exam hall.',1);return null}
  if(cap<rows.length){toast('Not enough seats: '+rows.length+' participants, '+cap+' seats selected.',1);return null}
  let k=0;return rooms.map(r=>({room:r.no,rows:rows.slice(k,k+=r.seats).map((x,i)=>({seat:String.fromCharCode(65+Math.floor(i/18))+(i%18+1),...x}))})).filter(r=>r.rows.length)};
 const csv=res=>{const c='Room,Seat,Subject,Roll No\n'+res.flatMap(r=>r.rows.map(x=>[r.room,x.seat,x.sub,x.roll].join(','))).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:'text/csv'}));a.download='seating-'+S.sd+'-'+S.st+'.csv';a.click()};
 $('#ad').onchange=e=>{S.sd=e.target.value;S.se='*';times();exSel();stats()};
 $('#at').onchange=e=>{S.st=e.target.value;S.se='*';exSel();stats()};
 $('#ae').onchange=e=>{S.se=e.target.value;stats()};
 $('#aq').oninput=e=>{S.rq=e.target.value;chips()};$('#ao').onchange=e=>{S.rs=e.target.value;chips()};
 $('#arr').onclick=()=>{const res=build();if(!res)return;savePlan(res);const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="mbox" role="dialog" aria-label="Seating arrangement"><h2>Seating arranged</h2><div class="scroll">${res.map(r=>`<div class="rm"><h4>Room ${r.room} · ${r.rows.length} students</h4><table><thead><tr><th>Seat</th><th>Subject</th><th>Roll No</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${x.seat}</td><td>${x.sub}</td><td>${x.roll}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div><div class="foot"><button class="btn gray" id="mc">Close</button><button class="btn green pill" id="md">Download CSV</button></div></div>`;
  document.body.appendChild(m);m.querySelector('#mc').onclick=()=>m.remove();m.querySelector('#md').onclick=()=>csv(res)};
 $('#mail').onclick=()=>{const res=build();if(!res)return;savePlan(res);csv(res);toast('Email needs a server, so the file was downloaded instead.')};
 times();exSel();chips();stats()}};
INIT.db=()=>{const tbl=r=>!r.length?'<div class="empty">No rows.</div>':`<div class="scroll"><table><thead><tr>${Object.keys(r[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>${r.map(o=>`<tr>${Object.values(o).map(v=>`<td>${v==null?'':v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 $('#dbc').innerHTML=['room','student','invigilator','exam','seat_alloc','duty','audit'].map(t=>`<div class="card"><b>${col('SELECT COUNT(*) FROM '+t)[0]}</b>${t}</div>`).join('');
 $('#dba').innerHTML=tbl(rows('SELECT id,ts,action,detail FROM audit ORDER BY id DESC LIMIT 40'));
 $('#qf').onsubmit=e=>{e.preventDefault();const q=$('#qt').value.trim();if(!/^(select|with|explain)/i.test(q)){toast('Only SELECT, WITH and EXPLAIN queries are allowed here.',1);return}
  try{const r=rows(q.replace(/;+\s*$/,''));$('#qr').innerHTML=tbl(r.slice(0,200))+`<p style="color:var(--mut);margin:10px 0 0">${r.length} rows</p>`}catch(x){$('#qr').innerHTML='<div class="empty" style="color:var(--red)">'+x.message+'</div>'}};
 $('#rst').onclick=()=>{try{localStorage.removeItem('esa_db')}catch(e){}location.reload()};$('#qf').onsubmit(new Event('submit'))};
INIT.charts=()=>{if(!S.plans.length)return;const cur=()=>S.plans[+$('#cp').value];
 const rooms=()=>{$('#cr').innerHTML=cur().res.map(r=>`<option>${r.room}</option>`).join('')};
 const draw=()=>{const v=roomView(cur(),$('#cr').value);$('#cg').innerHTML=v.g;$('#cs').innerHTML=v.s};
 $('#cp').onchange=()=>{rooms();draw()};$('#cr').onchange=draw;rooms();draw()};
INIT.portal=()=>{let tab='s';
 const stu=()=>{$('#pb').innerHTML='<form class="row" id="sf"><label class="f">Roll number<input id="sr" placeholder="MUT21CS001" required></label><button class="btn blue">Find seat</button></form><div id="sres" style="margin-top:20px"></div>';
  $('#sf').onsubmit=e=>{e.preventDefault();const q=$('#sr').value.trim().toUpperCase(),hits=[];
   rows('SELECT * FROM v_student_slip WHERE roll=?',[q]).forEach(v=>{const p=S.plans.find(z=>z.date===v.date&&z.time===v.time),r=p&&p.res.find(z=>z.room===v.room),x=r&&r.rows.find(z=>z.roll===v.roll);if(x)hits.push({p,r,x,name:v.name})});
   $('#sres').innerHTML=hits.length?hits.map(slip).join(''):`<div class="empty">${S.plans.length?'No seat found for '+q+'. Check the roll number and try again.':'No seating plan has been published yet.'}</div>`}};
 const inv=()=>{$('#pb').innerHTML=`<div class="row"><label class="f">Name or employee ID<input id="iq" list="il" placeholder="E1001"></label><datalist id="il">${INV.map(i=>`<option value="${i.id}">${i.name}</option>`).join('')}</datalist><label class="f">Date<select id="id"><option value="">All dates</option>${[...new Set(S.plans.map(p=>p.date))].map(d=>`<option value="${d}">${fmt(d)}</option>`).join('')}</select></label><label class="f">Session<select id="is"><option value="">All</option><option>FN</option><option>AN</option></select></label><label class="f">Hall<input id="ih" placeholder="All halls"></label></div><div id="ires" style="margin-top:20px"></div>`;
  const card=d=>{const r=d.p.res.find(x=>x.room===d.room),rm=S.rooms.find(x=>x.no===d.room)||{block:'-',floor:'-'},v=roomView(d.p,d.room),cs={};r.rows.forEach(x=>cs[x.sub]=(cs[x.sub]||0)+1);
   return `<div class="slip" style="max-width:none"><div class="sh"><b>Hall ${d.room} · ${rm.block}, floor ${rm.floor}</b><span>${fmt(d.p.date)} · ${d.p.time}</span></div><div class="sg"><div><small>Students</small><b>${r.rows.length}</b></div>${Object.keys(cs).map(k=>`<div><small>${k}</small><b>${cs[k]} students</b></div>`).join('')}</div>${v.g}<p style="color:var(--mut);margin:12px 0 0">Duties: check admit cards against this chart, hand out and collect answer scripts, and report malpractice to the chief invigilator.</p></div>`};
  const draw=()=>{const q=$('#iq').value.trim().toLowerCase(),me=INV.find(i=>i.id.toLowerCase()===q)||(q?INV.find(i=>i.name.toLowerCase().includes(q)):null),o=$('#ires');
   if(!q){o.innerHTML='<div class="empty">Enter your name or employee ID to see your duties.</div>';return}
   if(!me){o.innerHTML='<div class="empty">No invigilator found for “'+$('#iq').value.trim()+'”.</div>';return}
   const dd=$('#id').value,ss=$('#is').value,hh=$('#ih').value.trim().toLowerCase(),ds=[];
   S.plans.forEach(p=>p.duty.forEach(d=>{if(d.inv===me.id&&(!dd||p.date===dd)&&(!ss||p.time===ss)&&(!hh||d.room.toLowerCase()===hh))ds.push({p,room:d.room})}));
   o.innerHTML=`<h3 style="margin:0 0 14px">${me.name} · ${me.id} · ${me.dept} department · ${ds.length} duties</h3>`+(ds.length?ds.map(card).join(''):'<div class="empty">No duties match. Duties appear once the admin arranges seats.</div>')};
  ['iq','id','is','ih'].forEach(k=>{$('#'+k).oninput=draw;$('#'+k).onchange=draw});draw()};
 const show=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));tab==='s'?stu():inv()};
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{tab=b.dataset.t;show()});show()};

