const load = () => JSON.parse(localStorage.getItem('FAKE_FS') || '{}');
const save = s => localStorage.setItem('FAKE_FS', JSON.stringify(s));
const off = () => { if (localStorage.getItem('FAKE_OFFLINE')) throw new Error('offline'); };
const deep = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k]==='object' && !Array.isArray(b[k]) && a[k] && typeof a[k]==='object' && !Array.isArray(a[k])) deep(a[k], b[k]); else a[k] = b[k]; } return a; };
const chk = v => { JSON.stringify(v, (k, x) => { if (x === undefined) throw new Error('undefined field ' + k); return x; }); };
window.__fsWrites = 0;
export function getFirestore(){ return {}; }
export function doc(db, ...p){ return { path: p.join('/') }; }
export function collection(db, ...p){ return { path: p.join('/') }; }
export async function getDoc(ref){ off(); const s = load(); const d = s[ref.path]; return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; }
export async function setDoc(ref, data, opts){ off(); chk(data); window.__fsWrites++; const s = load(); s[ref.path] = (opts && opts.merge && s[ref.path]) ? deep(s[ref.path], JSON.parse(JSON.stringify(data))) : JSON.parse(JSON.stringify(data)); save(s); }
export async function deleteDoc(ref){ off(); const s = load(); delete s[ref.path]; save(s); }
export async function getDocs(col){ off(); const s = load(); const pre = col.path + '/';
  const docs = Object.keys(s).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(k => ({ id: k.slice(pre.length), data: () => JSON.parse(JSON.stringify(s[k])) }));
  return { empty: !docs.length, size: docs.length, forEach: f => docs.forEach(f) }; }
