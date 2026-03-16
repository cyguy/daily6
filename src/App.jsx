import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEYS = {
  log: "daily6_log",
  startKey: "daily6_startKey",
  onboardingComplete: "daily6_onboarding_complete",
  habits: "daily6_habits",
  commitmentStartDate: "daily6_commitment_start",
};
const COMMITMENT_DAYS = 90;

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD = "#F5C518";
const GREEN = "#34C759";
const ORANGE = "#FF9500";
const RED = "#FF3B30";

// Default habits only used before onboarding; after onboarding we use stored habits
const DEFAULT_HABITS = [
  "Eat 180g protein",
  "Walk 10,000 steps",
  "Lift weights",
  "Do 50 pushups",
  "Drink 1 gallon water",
  "Lights out by 10:30 PM",
];

function getDefaultStartKey() {
  return new Date().toISOString().split("T")[0];
}

// Seed demo data so the calendar looks lived-in
function seedLog() {
  const log = {};
  const today = new Date();
  for (let i = 1; i <= 18; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const count = i === 3 || i === 7 || i === 12 ? 0
      : i % 5 === 0 ? Math.floor(Math.random() * 4) + 1
      : Math.random() > 0.25 ? 6 : Math.floor(Math.random() * 5) + 1;
    const checked = Array.from({ length: 6 }, (_, idx) => idx < count);
    log[key] = { checked, note: count === 6 ? "Great day, stayed on track." : count === 0 ? "" : "Did what I could today." };
  }
  const todayKey = today.toISOString().split("T")[0];
  log[todayKey] = { checked: [true, true, false, true, false, false], note: "" };
  return log;
}

function getEarliestKey(log) {
  const keys = Object.keys(log).filter(k => k.length === 10);
  return keys.length ? keys.sort()[0] : getDefaultStartKey();
}

function loadSavedState() {
  try {
    const rawLog = localStorage.getItem(STORAGE_KEYS.log);
    const savedStart = localStorage.getItem(STORAGE_KEYS.startKey);
    if (rawLog) {
      const log = JSON.parse(rawLog);
      const startKey = savedStart || getEarliestKey(log) || getDefaultStartKey();
      return { log, startKey };
    }
  } catch (_) {}
  return { log: {}, startKey: getDefaultStartKey() };
}

const todayKey = () => new Date().toISOString().split("T")[0];

function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function offsetKey(key, days) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDayHeader(key) {
  return keyToDate(key).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function getDayLabel(key) {
  const tk = todayKey();
  if (key === tk) return "Today";
  if (key === offsetKey(tk, -1)) return "Yesterday";
  const diff = Math.floor((keyToDate(tk) - keyToDate(key)) / 86400000);
  return `${diff} days ago`;
}

function getDayNumber(startKey, currentKey) {
  const start = keyToDate(startKey);
  const current = keyToDate(currentKey);
  start.setHours(0,0,0,0); current.setHours(0,0,0,0);
  return Math.max(1, Math.floor((current - start) / 86400000) + 1);
}

function getColor(count) {
  if (count === 6) return GREEN;
  if (count > 0) return ORANGE;
  return RED;
}

function getBg(count) {
  if (count === 6) return "#0B2210";
  if (count > 0) return "#271800";
  return "#200A0A";
}

// ─── Onboarding state ─────────────────────────────────────────────────────────
function loadOnboardingState() {
  try {
    const complete = localStorage.getItem(STORAGE_KEYS.onboardingComplete) === "true";
    const rawHabits = localStorage.getItem(STORAGE_KEYS.habits);
    const commitmentStart = localStorage.getItem(STORAGE_KEYS.commitmentStartDate);
    const habits = rawHabits ? JSON.parse(rawHabits) : null;
    return { complete, habits, commitmentStart: commitmentStart || null };
  } catch (_) {}
  return { complete: false, habits: null, commitmentStart: null };
}

function getDaysRemaining(commitmentStartDate) {
  if (!commitmentStartDate) return 0;
  const start = new Date(commitmentStartDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + COMMITMENT_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remaining = Math.ceil((end - today) / 86400000);
  return Math.max(0, remaining);
}

// AI-style suggestions from goal (keyword-based, no API)
function getSuggestedHabits(goal) {
  const g = (goal || "").toLowerCase();
  const presets = {
    fitness: [
      "Eat 180g protein",
      "Walk 10,000 steps",
      "Lift weights or strength train",
      "Do 50 pushups",
      "Drink 1 gallon water",
      "Lights out by 10:30 PM",
    ],
    health: [
      "Eat a vegetable with every meal",
      "Walk 10,000 steps",
      "Drink 8 glasses of water",
      "No screens 1 hour before bed",
      "10 min stretching or mobility",
      "Log what I ate",
    ],
    productivity: [
      "Deep work block (90 min)",
      "Clear inbox to zero",
      "Top 3 priorities written down",
      "No social media before noon",
      "Review tomorrow the night before",
      "One thing done before phone",
    ],
    focus: [
      "Morning routine without phone",
      "Single-tasking blocks (no multitask)",
      "One hardest task before lunch",
      "No notifications during work",
      "Evening wind-down routine",
      "Sleep by 10:30 PM",
    ],
    mindfulness: [
      "10 min meditation",
      "Gratitude (3 things)",
      "One act of kindness",
      "No phone first 30 min",
      "10 min outside",
      "Journal 5 min",
    ],
    sleep: [
      "Lights out by 10:30 PM",
      "No caffeine after 2 PM",
      "No screens 1 hour before bed",
      "Same wake time",
      "Dark, cool room",
      "Wind-down routine",
    ],
  };
  for (const [key, habits] of Object.entries(presets)) {
    if (g.includes(key)) return [...habits];
  }
  // Fallback: generic habits that reference the goal
  const short = g.slice(0, 30);
  return [
    short ? `Work toward: ${short}${short.length >= 30 ? "…" : ""}` : "Daily action 1",
    "Morning routine completed",
    "One priority task done",
    "Move body 30+ minutes",
    "Reflect or journal 5 min",
    "Wind down by 10:30 PM",
  ];
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const G = {
  font: `'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
  serif: `'DM Serif Display', Georgia, serif`,
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { background: #000; color: #fff; font-family: ${G.font}; -webkit-font-smoothing: antialiased; }

.shell {
  max-width: 390px;
  margin: 0 auto;
  min-height: 100vh;
  background: #000;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* ── Demo banner ── */
.demo-banner {
  margin: 0 20px 16px;
  background: #0d1a0d;
  border: 1px solid #1a2a1a;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.demo-banner-text { font-size: 12px; color: #666; }
.demo-banner-btn {
  background: ${GOLD}; color: #000; border: none;
  font-family: ${G.font}; font-size: 12px; font-weight: 600;
  padding: 8px 14px; border-radius: 8px; cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}
.demo-banner-btn:hover { opacity: 0.9; transform: scale(1.02); }

/* ── Onboarding ── */
.onboarding-shell {
  max-width: 390px;
  margin: 0 auto;
  min-height: 100vh;
  background: #000;
  padding: 40px 24px 32px;
  display: flex;
  flex-direction: column;
}
.onboard-title { font-family: ${G.serif}; font-size: 32px; color: #fff; margin-bottom: 12px; line-height: 1.2; }
.onboard-title span { color: ${GOLD}; }
.onboard-sub { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px; }
.onboard-commit {
  background: #0d1508;
  border: 1px solid #1a2a0f;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 28px;
}
.onboard-commit p { font-size: 13px; color: #888; line-height: 1.55; margin: 0; }
.onboard-commit strong { color: ${GOLD}; font-weight: 600; }
.onboard-choices { display: flex; flex-direction: column; gap: 12px; }
.onboard-btn {
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 12px;
  color: #fff;
  font-family: ${G.font};
  font-size: 15px;
  font-weight: 500;
  padding: 16px 20px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.onboard-btn:hover { border-color: ${GOLD}; background: #181508; }
.onboard-btn.secondary { background: transparent; color: #888; }
.onboard-btn.secondary:hover { color: ${GOLD}; }
.onboard-back { background: none; border: none; color: #666; font-size: 13px; cursor: pointer; margin-bottom: 20px; padding: 0; }
.onboard-back:hover { color: ${GOLD}; }
.onboard-label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #444; margin-bottom: 8px; text-transform: uppercase; }
.onboard-input {
  width: 100%;
  background: #0c0c0c;
  border: 1px solid #1a1a1a;
  border-radius: 10px;
  color: #fff;
  font-family: ${G.font};
  font-size: 15px;
  padding: 14px 16px;
  margin-bottom: 16px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.onboard-input:focus { border-color: #333; }
.onboard-input::placeholder { color: #444; }
.onboard-cta {
  background: ${GOLD};
  color: #000;
  border: none;
  font-family: ${G.font};
  font-size: 15px;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
.onboard-cta:hover { opacity: 0.9; }
.onboard-cta:disabled { opacity: 0.5; cursor: not-allowed; }
.onboard-suggestions { margin-top: 20px; }
.onboard-suggestions .habit-preview { font-size: 14px; color: #aaa; padding: 10px 0; border-bottom: 1px solid #1a1a1a; }
.onboard-lock { font-size: 12px; color: #555; margin-top: 24px; }

/* ── Nav bar ── */
.nav-bar {
  display: flex;
  border-top: 1px solid #1a1a1a;
  background: rgba(0,0,0,0.96);
  backdrop-filter: blur(24px);
  padding: 10px 0 22px;
  flex-shrink: 0;
}
.nav-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 3px; background: none; border: none; cursor: pointer;
  font-family: ${G.font}; font-size: 10px; letter-spacing: 0.12em;
  text-transform: uppercase; transition: color 0.2s; padding: 5px 0;
  color: #444;
}
.nav-btn.active { color: ${GOLD}; }

/* ── Day navigation strip ── */
.day-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  margin-bottom: 20px;
  gap: 8px;
}
.day-nav-arrow {
  width: 34px; height: 34px;
  background: #111; border: 1px solid #1e1e1e;
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 18px; color: #ccc;
  transition: border-color 0.2s, color 0.2s, opacity 0.2s;
  flex-shrink: 0; user-select: none;
}
.day-nav-arrow:hover:not(:disabled) { border-color: ${GOLD}; color: ${GOLD}; }
.day-nav-arrow:disabled, .day-nav-arrow.disabled { opacity: 0.2; cursor: not-allowed; }

.day-nav-center {
  flex: 1;
  text-align: center;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 10px;
  transition: background 0.15s;
}
.day-nav-center:hover { background: #111; }
.day-nav-label {
  font-size: 12px; color: ${GOLD}; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px;
}
.day-nav-date { font-size: 13px; color: #666; }

/* ── Past day banner ── */
.past-banner {
  margin: 0 20px 16px;
  background: #141000;
  border: 1px solid #2a1f00;
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideDown 0.2s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.past-banner-icon { font-size: 14px; }
.past-banner-text { font-size: 12px; color: #888; flex: 1; }
.past-banner-text strong { color: ${GOLD}; font-weight: 600; }
.past-banner-today {
  font-size: 11px; color: #555; cursor: pointer; text-decoration: underline;
  white-space: nowrap;
}
.past-banner-today:hover { color: ${GOLD}; }

/* ── Dashboard ── */
.screen { flex: 1; overflow-y: auto; padding: 52px 20px 24px; }

.dash-header { margin-bottom: 28px; }
.dash-day { font-family: ${G.serif}; font-size: 52px; line-height: 1; color: #fff; }
.dash-day span { color: ${GOLD}; }
.dash-date { font-size: 13px; color: #444; margin-top: 5px; letter-spacing: 0.03em; }

.progress-wrap { height: 2px; background: #181818; border-radius: 2px; margin-bottom: 8px; overflow: hidden; }
.progress-fill { height: 100%; background: ${GOLD}; border-radius: 2px; transition: width 0.4s cubic-bezier(0.34,1.56,0.64,1); }
.progress-label { font-size: 11px; color: #333; letter-spacing: 0.05em; margin-bottom: 20px; }
.progress-label.done { color: ${GOLD}; }

.habits-list { list-style: none; border-top: 1px solid #111; }
.habit-row {
  display: flex; align-items: center; gap: 14px;
  padding: 15px 0; border-bottom: 1px solid #111;
  cursor: pointer; user-select: none; transition: opacity 0.15s;
}
.habit-row:hover { opacity: 0.75; }
.habit-row:active { opacity: 0.5; }

.checkbox {
  width: 26px; height: 26px; border-radius: 8px;
  border: 2px solid #2a2a2a; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.22s cubic-bezier(0.34,1.56,0.64,1),
              border-color 0.22s,
              transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
  position: relative;
}
.checkbox.on {
  background: ${GOLD}; border-color: ${GOLD};
  transform: scale(1.08);
  animation: cbpop 0.28s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes cbpop {
  0% { transform: scale(1); }
  55% { transform: scale(1.22); }
  100% { transform: scale(1.08); }
}
.checkmark {
  width: 10px; height: 6px;
  border-left: 2px solid #000; border-bottom: 2px solid #000;
  transform: rotate(-45deg) translateY(-1px);
  opacity: 0; transition: opacity 0.15s 0.05s;
}
.checkbox.on .checkmark { opacity: 1; }
.habit-label {
  font-size: 15.5px; color: #ddd; flex: 1;
  transition: color 0.2s;
}
.habit-row.done .habit-label { color: #444; text-decoration: line-through; text-decoration-color: #2a2a2a; }

.note-section { margin-top: 28px; }
.note-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: #333; margin-bottom: 10px;
}
.note-input {
  width: 100%; background: #0c0c0c; border: 1px solid #1a1a1a;
  border-radius: 12px; color: #aaa; font-family: ${G.font};
  font-size: 14px; line-height: 1.65; padding: 13px 15px;
  outline: none; resize: none; caret-color: ${GOLD};
  transition: border-color 0.2s; min-height: 88px;
}
.note-input:focus { border-color: #252525; }
.note-input::placeholder { color: #252525; }

/* ── Calendar ── */
.cal-screen { flex: 1; overflow-y: auto; padding: 52px 20px 100px; }
.cal-title { font-family: ${G.serif}; font-size: 34px; color: #fff; margin-bottom: 4px; }
.cal-sub { font-size: 13px; color: #444; margin-bottom: 28px; }

.streak-banner {
  background: #141000; border: 1px solid #2a1f00;
  border-radius: 14px; padding: 14px 18px;
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 24px;
}
.streak-num { font-size: 20px; font-weight: 700; color: ${GOLD}; }
.streak-sub { font-size: 12px; color: #666; margin-top: 1px; }

.month-nav {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 16px;
}
.month-label { font-size: 15px; font-weight: 600; color: #bbb; }
.mnav-btn {
  width: 30px; height: 30px; background: #111;
  border: 1px solid #1e1e1e; border-radius: 8px;
  color: #fff; cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.mnav-btn:hover { border-color: #333; }

.wday-row { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; margin-bottom: 4px; }
.wday { text-align: center; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; color: #2e2e2e; text-transform: uppercase; padding: 3px 0; }

.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
.cal-cell {
  aspect-ratio: 1; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 500;
  cursor: pointer; transition: transform 0.12s, filter 0.12s;
  position: relative;
}
.cal-cell:not(.empty):not(.future):hover { transform: scale(1.12); z-index: 2; filter: brightness(1.2); }
.cal-cell.empty { background: transparent; cursor: default; }
.cal-cell.future { background: #0a0a0a; color: #1e1e1e; cursor: default; }
.cal-cell.today { box-shadow: 0 0 0 2px ${GOLD}; }
.cal-cell.selected { box-shadow: 0 0 0 2px #fff; transform: scale(1.12); z-index: 2; }

.legend { display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
.leg-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #444; }
.leg-dot { width: 11px; height: 11px; border-radius: 3px; }

/* ── Date picker modal ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 100; animation: fadeIn 0.18s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal-sheet {
  background: #111; border: 1px solid #1e1e1e;
  border-radius: 20px 20px 0 0; width: 100%; max-width: 390px;
  padding: 20px 20px 40px;
  animation: slideUp 0.22s cubic-bezier(0.34,1.2,0.64,1);
}
@keyframes slideUp {
  from { transform: translateY(60px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.modal-handle {
  width: 36px; height: 4px; background: #2a2a2a;
  border-radius: 2px; margin: 0 auto 20px;
}
.modal-title { font-family: ${G.serif}; font-size: 22px; color: #fff; margin-bottom: 4px; }
.modal-sub { font-size: 12px; color: #444; margin-bottom: 20px; }
.modal-wdays { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; margin-bottom: 4px; }
.modal-cell {
  aspect-ratio: 1; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: transform 0.1s;
}
.modal-cell:not(.empty):not(.future):hover { transform: scale(1.08); }
.modal-cell.today-cell { box-shadow: 0 0 0 1.5px ${GOLD}; }
.modal-cell.active-cell { box-shadow: 0 0 0 2px #fff; }
`;

// ─── Onboarding ──────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState("intro"); // intro | custom | goal | confirm
  const [customHabits, setCustomHabits] = useState(["", "", "", "", "", ""]);
  const [goal, setGoal] = useState("");
  const [suggestedHabits, setSuggestedHabits] = useState(null);
  const [generating, setGenerating] = useState(false);

  const handleIntroChoose = () => setStep("custom");
  const handleIntroGoal = () => setStep("goal");

  const updateCustomHabit = (i, value) => {
    setCustomHabits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const canSubmitCustom = customHabits.every((h) => h.trim().length > 0);
  const handleSubmitCustom = () => {
    const habits = customHabits.map((h) => h.trim()).filter(Boolean);
    if (habits.length === 6) {
      finishOnboarding(habits);
    }
  };

  const handleGenerate = () => {
    if (!goal.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      setSuggestedHabits(getSuggestedHabits(goal.trim()));
      setGenerating(false);
      setStep("confirm");
    }, 600);
  };

  const handleConfirmSuggestions = () => {
    if (suggestedHabits && suggestedHabits.length === 6) {
      finishOnboarding(suggestedHabits);
    }
  };

  function finishOnboarding(habits) {
    const start = new Date().toISOString().split("T")[0];
    localStorage.setItem(STORAGE_KEYS.onboardingComplete, "true");
    localStorage.setItem(STORAGE_KEYS.habits, JSON.stringify(habits));
    localStorage.setItem(STORAGE_KEYS.commitmentStartDate, start);
    onComplete(habits, start);
  }

  return (
    <div className="onboarding-shell">
      <style>{css}</style>
      {step === "intro" && (
        <>
          <h1 className="onboard-title">Daily <span>6</span></h1>
          <p className="onboard-sub">Pick 6 habits. Track them every day. Build consistency.</p>
          <div className="onboard-commit">
            <p><strong>90-day commitment:</strong> Once you set your 6 habits, you won't be able to change them for 90 days. That's how you build the consistency you want—no switching, no second-guessing.</p>
          </div>
          <div className="onboard-choices">
            <button type="button" className="onboard-btn" onClick={handleIntroChoose}>
              I'll choose my 6 habits
            </button>
            <button type="button" className="onboard-btn secondary" onClick={handleIntroGoal}>
              Suggest habits from my goal
            </button>
          </div>
        </>
      )}

      {step === "custom" && (
        <>
          <button type="button" className="onboard-back" onClick={() => setStep("intro")}>← Back</button>
          <h1 className="onboard-title">Your 6 habits</h1>
          <p className="onboard-sub">Enter one habit per line. You'll track these every day for 90 days.</p>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <div className="onboard-label">Habit {i + 1}</div>
              <input
                className="onboard-input"
                type="text"
                placeholder={`e.g. ${DEFAULT_HABITS[i]}`}
                value={customHabits[i]}
                onChange={(e) => updateCustomHabit(i, e.target.value)}
              />
            </div>
          ))}
          <p className="onboard-lock">These 6 habits will be locked for 90 days.</p>
          <button type="button" className="onboard-cta" disabled={!canSubmitCustom} onClick={handleSubmitCustom}>
            Start my 90 days
          </button>
        </>
      )}

      {step === "goal" && (
        <>
          <button type="button" className="onboard-back" onClick={() => setStep("intro")}>← Back</button>
          <h1 className="onboard-title">What's your goal?</h1>
          <p className="onboard-sub">We'll suggest 6 habits based on your answer (e.g. "get fit", "better sleep", "focus at work").</p>
          <input
            className="onboard-input"
            type="text"
            placeholder="e.g. Build strength and energy"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <button type="button" className="onboard-cta" disabled={!goal.trim() || generating} onClick={handleGenerate}>
            {generating ? "Generating…" : "Generate my 6 habits"}
          </button>
        </>
      )}

      {step === "confirm" && suggestedHabits && (
        <>
          <button type="button" className="onboard-back" onClick={() => { setStep("goal"); setSuggestedHabits(null); }}>← Back</button>
          <h1 className="onboard-title">Your 6 habits</h1>
          <p className="onboard-sub">Based on your goal. Locked for 90 days once you start.</p>
          <div className="onboard-suggestions">
            {suggestedHabits.map((h, i) => (
              <div key={i} className="habit-preview">{i + 1}. {h}</div>
            ))}
          </div>
          <p className="onboard-lock">You won't be able to change these for 90 days.</p>
          <button type="button" className="onboard-cta" onClick={handleConfirmSuggestions}>
            Start my 90 days
          </button>
        </>
      )}
    </div>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────────────
function Checkbox({ checked, onToggle, label }) {
  return (
    <li className={`habit-row${checked ? " done" : ""}`} onClick={onToggle}>
      <div className={`checkbox${checked ? " on" : ""}`}>
        <div className="checkmark" />
      </div>
      <span className="habit-label">{label}</span>
    </li>
  );
}

// ─── Day navigation strip ────────────────────────────────────────────────────
function DayNav({ currentKey, onPrev, onNext, onPickDate }) {
  const today = todayKey();
  const isToday = currentKey === today;
  const label = getDayLabel(currentKey);

  return (
    <div className="day-nav">
      <div className="day-nav-arrow" onClick={onPrev} title="Previous day">‹</div>

      <div className="day-nav-center" onClick={onPickDate}>
        <div className="day-nav-label">{label}</div>
        <div className="day-nav-date">{formatDayHeader(currentKey).split(",").slice(0,1)[0]}, {keyToDate(currentKey).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
      </div>

      <div
        className={`day-nav-arrow${isToday ? " disabled" : ""}`}
        onClick={!isToday ? onNext : undefined}
        title="More recent day"
      >›</div>
    </div>
  );
}

// ─── Date picker modal ────────────────────────────────────────────────────────
function DatePickerModal({ log, currentKey, startKey, onSelect, onClose }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const today = todayKey();

  function cellKey(day) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-title">Jump to Day</div>
        <div className="modal-sub">Tap any past day to edit it</div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <button className="mnav-btn" onClick={() => { viewMonth===0 ? (setViewMonth(11),setViewYear(y=>y-1)) : setViewMonth(m=>m-1) }}>‹</button>
          <span className="month-label">{new Date(viewYear,viewMonth).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
          <button className="mnav-btn" onClick={() => { viewMonth===11 ? (setViewMonth(0),setViewYear(y=>y+1)) : setViewMonth(m=>m+1) }}>›</button>
        </div>

        <div className="modal-wdays">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
            <div key={d} className="wday">{d}</div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`e${idx}`} style={{aspectRatio:1}} />;
            const key = cellKey(day);
            const isFuture = key > today;
            const isToday = key === today;
            const isActive = key === currentKey;
            const dayLog = log[key];
            const count = dayLog ? dayLog.checked.filter(Boolean).length : -1;

            const bg = isFuture ? "#0a0a0a"
              : isToday ? "#0a0a0a"
              : dayLog ? getBg(count)
              : "#0a0a0a";
            const color = isFuture ? "#1e1e1e"
              : dayLog ? getColor(count)
              : "#2a2a2a";

            return (
              <div
                key={day}
                className={`modal-cell${isFuture?" future":""}`}
                style={{
                  background: bg, color,
                  boxShadow: isActive ? "0 0 0 2px #fff" : isToday ? `0 0 0 1.5px ${GOLD}` : "none",
                  cursor: isFuture ? "default" : "pointer",
                }}
                onClick={() => !isFuture && (onSelect(key), onClose())}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ habits, log, currentKey, startKey, commitmentStartDate, onToggle, onNote, onPrev, onNext, onPickDate }) {
  const today = todayKey();
  const isPast = currentKey !== today;
  const dayLog = log[currentKey] || { checked: [false,false,false,false,false,false], note: "" };
  const checkedCount = dayLog.checked.filter(Boolean).length;
  const progress = checkedCount / 6;
  const dayNum = getDayNumber(startKey, currentKey);
  const daysLockedLeft = getDaysRemaining(commitmentStartDate);

  return (
    <>
      <div className="screen">
        <div className="dash-header">
          <div className="dash-day">Day <span>{dayNum}</span></div>
          <div className="dash-date">{formatDayHeader(currentKey)}</div>
        </div>

        <DayNav currentKey={currentKey} onPrev={onPrev} onNext={onNext} onPickDate={onPickDate} />

        {daysLockedLeft > 0 && (
          <div className="past-banner" style={{ background: "#0d1508", borderColor: "#1a2a0f" }}>
            <span className="past-banner-icon">🔒</span>
            <span className="past-banner-text">
              Your 6 habits are locked for <strong>{daysLockedLeft} more days</strong> to build consistency.
            </span>
          </div>
        )}

        {isPast && (
          <div className="past-banner">
            <span className="past-banner-icon">✎</span>
            <span className="past-banner-text">
              Editing <strong>{getDayLabel(currentKey)}</strong> — changes save instantly
            </span>
            <span className="past-banner-today" onClick={() => onNext(true)}>Go to today →</span>
          </div>
        )}

        <div className="progress-wrap">
          <div className="progress-fill" style={{ width:`${progress*100}%` }} />
        </div>
        <div className={`progress-label${checkedCount===6?" done":""}`}>
          {checkedCount===6 ? "✦ All done." : `${checkedCount} of 6 complete`}
        </div>

        <ul className="habits-list">
          {(habits || DEFAULT_HABITS).map((h, i) => (
            <Checkbox
              key={i}
              label={h}
              checked={dayLog.checked[i]}
              onToggle={() => onToggle(currentKey, i)}
            />
          ))}
        </ul>

        <div className="note-section">
          <div className="note-label">Note to self</div>
          <textarea
            className="note-input"
            placeholder={isPast ? "Add a note for this day..." : "What's on your mind today..."}
            value={dayLog.note}
            onChange={e => onNote(currentKey, e.target.value)}
            rows={4}
          />
        </div>
      </div>
    </>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ log, currentKey, startKey, onSelectDay }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const today = todayKey();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  while (true) {
    const k = d.toISOString().split("T")[0];
    const dl = log[k];
    if (dl && dl.checked.filter(Boolean).length === 6) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }

  function cellKey(day) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  return (
    <div className="cal-screen">
      <div className="cal-title">History</div>
      <div className="cal-sub">Tap any day to edit it</div>

      {streak > 0 && (
        <div className="streak-banner">
          <span style={{fontSize:26}}>🔥</span>
          <div>
            <div className="streak-num">{streak} day streak</div>
            <div className="streak-sub">All 6 completed. Keep it up.</div>
          </div>
        </div>
      )}

      <div className="month-nav">
        <button className="mnav-btn" onClick={() => viewMonth===0 ? (setViewMonth(11),setViewYear(y=>y-1)) : setViewMonth(m=>m-1)}>‹</button>
        <span className="month-label">{new Date(viewYear,viewMonth).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
        <button className="mnav-btn" onClick={() => viewMonth===11 ? (setViewMonth(0),setViewYear(y=>y+1)) : setViewMonth(m=>m+1)}>›</button>
      </div>

      <div className="wday-row">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div className="wday" key={d}>{d}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} className="cal-cell empty" />;
          const key = cellKey(day);
          const isFuture = key > today;
          const isToday = key === today;
          const isSelected = key === currentKey;
          const dl = log[key];
          const count = dl ? dl.checked.filter(Boolean).length : -1;

          const bg = isFuture ? "#0a0a0a" : dl ? getBg(count) : "#150505";
          const color = isFuture ? "#1e1e1e" : dl ? getColor(count) : RED;

          return (
            <div
              key={day}
              className={`cal-cell${isFuture?" future":""}${isToday?" today":""}${isSelected?" selected":""}`}
              style={{ background: bg, color }}
              onClick={() => !isFuture && (onSelectDay(key))}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="legend">
        {[[GREEN,"All 6"],[ORANGE,"Partial"],[RED,"Missed/None"]].map(([c,l])=>(
          <div className="leg-item" key={l}>
            <div className="leg-dot" style={{background:c}} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function getInitialState() {
  const onboarding = loadOnboardingState();
  const saved = loadSavedState();
  const hasExistingData = Object.keys(saved.log).length > 0;
  // Migrate existing users: if they have log data but never did onboarding, treat as onboarded with defaults
  const complete = onboarding.complete || hasExistingData;
  const habits = onboarding.habits || (hasExistingData ? DEFAULT_HABITS : null);
  const commitmentStart = onboarding.commitmentStart || (hasExistingData ? (saved.startKey || getEarliestKey(saved.log)) : null);
  return {
    onboardingComplete: complete,
    habits,
    commitmentStartDate: commitmentStart,
    log: saved.log,
    startKey: complete && commitmentStart ? commitmentStart : (saved.startKey || getDefaultStartKey()),
  };
}

export default function App() {
  const [state, setState] = useState(getInitialState);
  const { onboardingComplete, habits, commitmentStartDate, log, startKey } = state;
  const [tab, setTab] = useState("dashboard");
  const [currentKey, setCurrentKey] = useState(todayKey);
  const [showPicker, setShowPicker] = useState(false);

  // Persist log and startKey to localStorage whenever they change (only after onboarding)
  useEffect(() => {
    if (onboardingComplete) {
      localStorage.setItem(STORAGE_KEYS.log, JSON.stringify(log));
      localStorage.setItem(STORAGE_KEYS.startKey, startKey);
    }
  }, [onboardingComplete, log, startKey]);

  const handleOnboardingComplete = useCallback((newHabits, commitmentStart) => {
    setState((prev) => ({
      ...prev,
      onboardingComplete: true,
      habits: newHabits,
      commitmentStartDate: commitmentStart,
      startKey: commitmentStart,
      log: {},
    }));
    setCurrentKey(todayKey());
    setTab("dashboard");
  }, []);

  const toggleHabit = useCallback((key, i) => {
    setState((prev) => {
      const prevLog = prev.log;
      const existing = prevLog[key] || { checked:[false,false,false,false,false,false], note:"" };
      const checked = [...existing.checked];
      checked[i] = !checked[i];
      return { ...prev, log: { ...prevLog, [key]: { ...existing, checked } } };
    });
  }, []);

  const setNote = useCallback((key, note) => {
    setState((prev) => {
      const prevLog = prev.log;
      const existing = prevLog[key] || { checked:[false,false,false,false,false,false], note:"" };
      return { ...prev, log: { ...prevLog, [key]: { ...existing, note } } };
    });
  }, []);

  const goPrev = () => setCurrentKey(k => offsetKey(k, -1));

  const goNext = (jumpToday) => {
    if (jumpToday === true) { setCurrentKey(todayKey()); return; }
    setCurrentKey(k => {
      const next = offsetKey(k, 1);
      return next <= todayKey() ? next : k;
    });
  };

  const selectDay = (key) => {
    setCurrentKey(key);
    setTab("dashboard");
  };

  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <style>{css}</style>
      <div className="shell">
        {tab === "dashboard" && (
          <Dashboard
            habits={habits}
            log={log}
            currentKey={currentKey}
            startKey={startKey}
            commitmentStartDate={commitmentStartDate}
            onToggle={toggleHabit}
            onNote={setNote}
            onPrev={goPrev}
            onNext={goNext}
            onPickDate={() => setShowPicker(true)}
          />
        )}

        {tab === "calendar" && (
          <CalendarView
            log={log}
            currentKey={currentKey}
            startKey={startKey}
            onSelectDay={selectDay}
          />
        )}

        <nav className="nav-bar">
          <button className={`nav-btn${tab==="dashboard"?" active":""}`} onClick={()=>setTab("dashboard")}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            Today
          </button>
          <button className={`nav-btn${tab==="calendar"?" active":""}`} onClick={()=>setTab("calendar")}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            History
          </button>
        </nav>

        {showPicker && (
          <DatePickerModal
            log={log}
            currentKey={currentKey}
            startKey={startKey}
            onSelect={selectDay}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </>
  );
}
