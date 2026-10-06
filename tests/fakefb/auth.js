export function getAuth(){ return {}; }
export class GoogleAuthProvider {}
export async function signInWithPopup(){ localStorage.setItem('FAKE_SIGNED','1'); location.reload(); }
export async function signInWithRedirect(){}
export async function getRedirectResult(){ return null; }
export async function signOut(){ localStorage.removeItem('FAKE_SIGNED'); }
export function onAuthStateChanged(a, cb){ setTimeout(()=>cb(localStorage.getItem('FAKE_SIGNED') ? {uid:'u1', displayName:'Test'} : null), 50); }
