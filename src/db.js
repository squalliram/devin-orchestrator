const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '../data/sessions.json');
fs.mkdirSync(path.dirname(FILE), { recursive: true });
let db = {};
try { if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch(e) {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const upsertSession = d => { db[d.session_id] = { ...db[d.session_id], ...d, updated_at: new Date().toISOString() }; save(); };
const updateSession = (id, u) => { if (db[id]) { db[id] = { ...db[id], ...u, updated_at: new Date().toISOString() }; save(); } };
const getAllSessions = () => Object.values(db).sort((a,b) => new Date(b.started_at)-new Date(a.started_at)).map(s => {
  const ms = (s.finished_at ? new Date(s.finished_at) : new Date()) - new Date(s.started_at||Date.now());
  return { ...s, duration: `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s${s.finished_at?'':' (ongoing)'}` };
});
module.exports = { upsertSession, updateSession, getAllSessions };
