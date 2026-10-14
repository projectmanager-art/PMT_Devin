/* ============================================================
   ui.js — app state + DOM UI (works even if 3D fails to load)
   ============================================================ */

const STORE_KEY = "virtual-office-employees";
const DESK_SEATS = 15;   // desks spawn dynamically up to this, then couch / hot-desk

let employees = load();
function load() {
  try {
    return (JSON.parse(localStorage.getItem(STORE_KEY)) || [])
      .map(e => ({ ...e, seat: e.seat ?? e.slot }));   // migrate old saves
  } catch { return []; }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(employees)); }

const isPM = e => /manager|lead|head|director|pm/i.test(e.role);
const seatTaken = s => employees.some(e => e.seat === s);
const cabinTaken = () => seatTaken("cabin");
const freeDeskSeat = () => {
  for (let i = 0; i < DESK_SEATS; i++) if (!seatTaken(i)) return i;
  return -1;
};
const pickSeat = role => {
  if (isPM({ role }) && !cabinTaken()) return "cabin";
  const d = freeDeskSeat();
  if (d >= 0) return d;
  if (!seatTaken("couch0")) return "couch0";
  if (!seatTaken("couch1")) return "couch1";
  return "float";   // hot-desk: stands with laptop near lobby
};

/* ---------- toast ---------- */
const toastEl = document.getElementById("toast");
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2800);
}

/* ---------- headcount / empty banner ---------- */
const headcountNum = document.getElementById("headcountNum");
const emptyBanner = document.getElementById("emptyBanner");
function updateCounts() {
  headcountNum.textContent = employees.length;
  emptyBanner.hidden = employees.length > 0;
}

/* ---------- employee popover ---------- */
const deskPop = document.getElementById("deskPop");
let popEmp = null;
function openPop(emp, cx, cy) {
  popEmp = emp;
  document.getElementById("popName").textContent =
    (isPM(emp) ? "⭐ " : "") + emp.name;
  document.getElementById("popRole").textContent = `${emp.role} · ${emp.gender}`;
  deskPop.hidden = false;
  const pw = 190;
  deskPop.style.left = Math.max(8, Math.min(cx - pw / 2, innerWidth - pw - 8)) + "px";
  deskPop.style.top = Math.min(cy + 14, innerHeight - 140) + "px";
}
function closePop() { deskPop.hidden = true; popEmp = null; }

document.getElementById("popRemove").addEventListener("click", () => {
  if (!popEmp) return;
  const emp = popEmp;
  employees = employees.filter(x => x.id !== emp.id);
  save(); closePop(); updateCounts();
  dispatchEvent(new CustomEvent("vo:remove", { detail: emp }));
  showToast(`${emp.name.split(" ")[0]} left the office 👋`);
});
deskPop.addEventListener("click", e => e.stopPropagation());

/* ---------- modal / form ---------- */
const modal = document.getElementById("modalBackdrop");
const form = document.getElementById("empForm");
const fName = document.getElementById("fName");
const fRole = document.getElementById("fRole");
let selectedGender = null;

function openModal() {
  form.reset(); clearErrors(); selectGender(null);
  modal.hidden = false; fName.focus();
}
const closeModal = () => (modal.hidden = true);
const selectGender = g => {
  selectedGender = g;
  document.querySelectorAll(".gender-card").forEach(c =>
    c.classList.toggle("selected", c.dataset.gender === g));
};
const clearErrors = () =>
  document.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
const flagError = (el, on) => el.closest(".field").classList.toggle("invalid", on);

document.querySelectorAll(".gender-card").forEach(card =>
  card.addEventListener("click", () => { selectGender(card.dataset.gender); flagError(card, false); }));
document.getElementById("addBtn").addEventListener("click", openModal);
document.getElementById("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", e => e.target === modal && closeModal());
document.addEventListener("keydown", e => e.key === "Escape" && (closeModal(), closePop()));

form.addEventListener("submit", e => {
  e.preventDefault();
  const name = fName.value.trim(), role = fRole.value.trim();
  flagError(fName, !name); flagError(fRole, !role);
  flagError(document.getElementById("genderPicker"), !selectedGender);
  if (!name || !role || !selectedGender) return;

  const emp = {
    id: "emp-" + Date.now().toString(36) + Math.floor(Math.random() * 99),
    name, role, gender: selectedGender, seat: pickSeat(role),
  };
  employees.push(emp); save();
  updateCounts(); closeModal(); closePop();
  dispatchEvent(new CustomEvent("vo:add", { detail: emp }));
  showToast(`${name.split(" ")[0]} joined the office! 🎉`);
});

/* ---------- meeting + party buttons ---------- */
document.getElementById("meetingBtn").addEventListener("click", () => {
  if (window.__officeReady) {
    dispatchEvent(new CustomEvent("vo:meeting"));
  } else {
    showToast("3D scene abhi load nahi hua 😅");
  }
});
document.getElementById("partyBtn").addEventListener("click", () => {
  if (window.__officeReady) {
    dispatchEvent(new CustomEvent("vo:party"));
  } else {
    showToast("3D scene abhi load nahi hua 😅");
  }
});

/* ---------- shared API for the 3D layer ---------- */
window.VO = { isPM, openPop, closePop, toast: showToast, get employees() { return employees; } };
updateCounts();
