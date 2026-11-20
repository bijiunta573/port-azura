// save.js — localStorage persistence for cash and mission progress.
const KEY = 'port-azura-save-v1';
export function loadSave() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.cash === 'number') return { cash: s.cash | 0, mission: s.mission | 0, done: !!s.done }; } catch {} return null; }
export function writeSave(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }
