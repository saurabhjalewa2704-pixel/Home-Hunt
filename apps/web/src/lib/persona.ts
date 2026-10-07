/** Which of the two buyers is using this device. No login: you just pick (PRD S10 replaced). */
const KEY = "hh.me";

export function getPersona(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setPersona(id: string) {
  try {
    localStorage.setItem(KEY, id);
    sessionStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
export function clearPersona() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
