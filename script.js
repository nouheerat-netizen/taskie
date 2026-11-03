"use strict";

/* ========================================
   TASKIE! — YOUR HAPPY PLANNER
   HTML + CSS + Vanilla JavaScript
======================================== */

const KEYS = {
  tasks: "taskie.tasks.v2",
  xp: "taskie.xp.v1",
  theme: "taskie.theme.v1",
  mood: "taskie.mood.v1"
};

const XP_PER_TASK = 10;

const categories = {
  study: "📚 Study",
  personal: "🌸 Personal",
  work: "💻 Work",
  health: "🌿 Health",
  other: "✨ Other"
};

const rewards = [
  { xp: 0, name: "Fresh Start", icon: "🌱" },
  { xp: 30, name: "Little Star", icon: "⭐" },
  { xp: 70, name: "Bloom Buddy", icon: "🌷" },
  { xp: 120, name: "Super Planner", icon: "🦋" },
  { xp: 200, name: "Taskie Legend", icon: "👑" }
];

const quotes = [
  "You don't have to do it all. Just start with one thing.",
  "Progress, not perfection. You're doing better than you think.",
  "Small steps every day add up to lovely things.",
  "Take a breath. You can begin again whenever you need.",
  "Your future self will be glad you started today.",
  "You deserve to feel proud of the effort you make."
];

const $ = selector => document.querySelector(selector);

/* ========================================
   SAFE STORAGE AND DATE HELPERS
======================================== */

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`Could not load saved setting: ${key}`, error);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save setting: ${key}`, error);
    showToast("Unable to save. Check your browser storage.");
    return false;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* Parse YYYY-MM-DD as a local date, not UTC. */
function parseDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getMonday(date) {
  const monday = startOfDay(date);
  const weekday = monday.getDay();

  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));

  return monday;
}

function addDays(date, amount) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDate(value, options = {}) {
  const date = typeof value === "string" ? parseDate(value) : value;

  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...options
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function makeId() {
  return window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ========================================
   APPLICATION STATE
======================================== */

function normalizeTask(task) {
  if (
    !task ||
    typeof task.id !== "string" ||
    typeof task.title !== "string"
  ) {
    return null;
  }

  const validDueDate = task.due === "" ||
    (typeof task.due === "string" && parseDate(task.due) !== null);

  return {
    ...task,
    title: task.title,
    category: categories[task.category] ? task.category : "other",
    due: validDueDate ? task.due : "",
    completed: Boolean(task.completed),
    xpAwarded: Boolean(task.xpAwarded)
  };
}

let storedTasks = loadJSON(KEYS.tasks, []);

let tasks = Array.isArray(storedTasks)
  ? storedTasks.map(normalizeTask).filter(Boolean)
  : [];

let totalXP = Math.max(0, Number(loadJSON(KEYS.xp, 0)) || 0);

totalXP = Math.max(
  totalXP,
  tasks.filter(task => task.xpAwarded).length * XP_PER_TASK
);

let activeFilter = "all";
let editingId = null;
let selectedMood = null;
let toastTimer = null;

/*
  Both planner dates are calendar dates.
  weekStart is always Monday.
  selectedWeekDate always belongs to the displayed week.
*/
let weekStart = getMonday(new Date());
let selectedWeekDate = startOfDay(new Date());

function saveTasks() {
  return saveJSON(KEYS.tasks, tasks);
}

function saveXP() {
  return saveJSON(KEYS.xp, totalXP);
}

/* ========================================
   TOAST NOTIFICATIONS
======================================== */

function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ========================================
   TASK STATISTICS AND REWARDS
======================================== */

function currentReward() {
  return [...rewards]
    .reverse()
    .find(reward => totalXP >= reward.xp) || rewards[0];
}

function nextReward() {
  return rewards.find(reward => totalXP < reward.xp) || null;
}

function renderStats() {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percent = total ? Math.round(completed / total * 100) : 0;

  $("#totalStat").textContent = total;
  $("#completedStat").textContent = completed;
  $("#xpStat").textContent = `${totalXP} XP`;
  $("#rewardStat").textContent = currentReward().name;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressFill").style.width = `${percent}%`;

  $("#taskCountPill").textContent =
    `${total} ${total === 1 ? "task" : "tasks"}`;

  $("#progressCaption").textContent = !total
    ? "Add a task and start collecting little wins."
    : percent === 100
      ? "Everything on your list is done. Celebrate yourself! 🎉"
      : `${completed} of ${total} tasks completed. Keep going!`;

  $("#listSummary").textContent =
    `${total - completed} left to do · ${completed} done`;

  $("#xpTotal").textContent = totalXP;

  const next = nextReward();

  if (next) {
    const previous = currentReward().xp;
    const range = next.xp - previous;
    const earned = totalXP - previous;
    const progress = range ? earned / range * 100 : 100;

    $("#xpFill").style.width = `${Math.min(100, progress)}%`;
    $("#nextRewardText").textContent =
      `${next.xp - totalXP} XP to ${next.name}`;
    $("#xpGoal").textContent = `${next.xp} XP`;
  } else {
    $("#xpFill").style.width = "100%";
    $("#nextRewardText").textContent = "All rewards unlocked! Amazing!";
    $("#xpGoal").textContent = "MAX";
  }

  $("#rewardList").innerHTML = rewards.map(reward => {
    const unlocked = totalXP >= reward.xp;

    return `
      <div class="reward-item ${unlocked ? "unlocked" : ""}">
        <span class="reward-badge">${reward.icon}</span>
        <span class="reward-copy">
          <strong>${reward.name}</strong>
          <small>${reward.xp} XP required</small>
        </span>
        <span class="reward-status">
          ${unlocked ? "Unlocked ✓" : `${reward.xp} XP`}
        </span>
      </div>
    `;
  }).join("");
}

/* ========================================
   MAIN TASK LIST, SEARCH AND FILTERS
======================================== */

function isOverdue(task) {
  return Boolean(
    task.due &&
    !task.completed &&
    task.due < dateKey(new Date())
  );
}

function matchesFilter(task) {
  if (activeFilter === "pending") return !task.completed;
  if (activeFilter === "completed") return task.completed;
  if (activeFilter === "overdue") return isOverdue(task);

  return true;
}

function renderTasks() {
  const query = $("#taskSearch").value.trim().toLowerCase();

  const visibleTasks = tasks.filter(task => {
    const searchable =
      `${task.title} ${categories[task.category]} ${task.due}`.toLowerCase();

    return matchesFilter(task) && searchable.includes(query);
  });

  $("#taskList").innerHTML = visibleTasks.map(task => {
    const due = task.due
      ? `
        <span class="due-tag ${isOverdue(task) ? "overdue" : ""}">
          📅 ${formatDate(task.due)}
          ${isOverdue(task) ? " · Overdue" : ""}
        </span>
      `
      : "";

    return `
      <article
        class="task-item ${task.completed ? "completed" : ""}"
        data-id="${escapeHTML(task.id)}"
      >
        <input
          class="task-check"
          type="checkbox"
          aria-label="Complete ${escapeHTML(task.title)}"
          ${task.completed ? "checked" : ""}
        >

        <div class="task-body">
          <p class="task-title">${escapeHTML(task.title)}</p>

          <div class="task-meta">
            <span class="category-tag category-${task.category}">
              ${categories[task.category]}
            </span>
            ${due}
            ${task.xpAwarded ? "<span>⭐ +10 XP earned</span>" : ""}
          </div>
        </div>

        <div class="task-actions">
          <button
            type="button"
            class="task-action edit-task"
            aria-label="Edit task"
            title="Edit task"
          >✎</button>

          <button
            type="button"
            class="task-action delete delete-task"
            aria-label="Delete task"
            title="Delete task"
          >×</button>
        </div>
      </article>
    `;
  }).join("");

  const empty = visibleTasks.length === 0;

  $("#emptyState").classList.toggle("hidden", !empty);

  if (empty) {
    $("#emptyState").querySelector("h3").textContent =
      tasks.length ? "No tasks found" : "Your list is waiting!";

    $("#emptyState").querySelector("p").textContent =
      tasks.length
        ? "Try another search or filter."
        : "Add a task above and give your future self a high-five.";
  }
}

/* ========================================
   WEEKLY PLANNER — FIXED DATE LOGIC
======================================== */

function syncSelectedDateToWeek() {
  const weekEnd = addDays(weekStart, 6);

  if (
    selectedWeekDate < weekStart ||
    selectedWeekDate > weekEnd
  ) {
    selectedWeekDate = startOfDay(weekStart);
  }
}

function renderWeek() {
  const todayKey = dateKey(new Date());

  syncSelectedDateToWeek();

  const weekEnd = addDays(weekStart, 6);

  $("#weekLabel").textContent =
    `${formatDate(weekStart)} – ${formatDate(weekEnd, {
      year: "numeric"
    })}`;

  const selectedKey = dateKey(selectedWeekDate);

  /*
    Always render exactly seven dates beginning on Monday.
    Due dates are compared as YYYY-MM-DD strings.
    No-date tasks never match a day.
  */
  const daysHTML = [];

  for (let index = 0; index < 7; index++) {
    const date = addDays(weekStart, index);
    const key = dateKey(date);

    const isToday = key === todayKey;
    const isSelected = key === selectedKey;

    const hasTasks = tasks.some(task =>
      task.due !== "" && task.due === key
    );

    daysHTML.push(`
      <button
        type="button"
        class="day-button
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasTasks ? "has-tasks" : ""}"
        data-date="${key}"
        aria-pressed="${isSelected}"
        aria-label="${date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        })}${isToday ? ", today" : ""}"
      >
        <span class="day-name">
          ${date.toLocaleDateString(undefined, { weekday: "short" })}
        </span>
        <span class="day-number">${date.getDate()}</span>
        <span class="day-dot" aria-hidden="true"></span>
      </button>
    `);
  }

  $("#weekDays").innerHTML = daysHTML.join("");

  /*
    Strict date equality prevents tasks from appearing
    on the wrong day. An empty due date is never displayed.
  */
  const selectedTasks = tasks.filter(task =>
    task.due !== "" && task.due === selectedKey
  );

  const selectedIsToday = selectedKey === todayKey;

  $("#selectedDayTitle").textContent = selectedIsToday
    ? "Tasks for today"
    : `Tasks for ${selectedWeekDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric"
      })}`;

  $("#selectedDayCount").textContent =
    `${selectedTasks.length} ${
      selectedTasks.length === 1 ? "task" : "tasks"
    }`;

  $("#weekTaskList").innerHTML = selectedTasks.length
    ? selectedTasks.map(task => `
        <div class="week-task ${task.completed ? "done" : ""}">
          <span aria-hidden="true">${task.completed ? "✓" : "○"}</span>
          <span class="week-task-title">${escapeHTML(task.title)}</span>
          <span class="category-tag category-${task.category}">
            ${categories[task.category]}
          </span>
        </div>
      `).join("")
    : `
      <div class="week-empty">
        No tasks due this day. Enjoy a little breathing room! 🌼
      </div>
    `;
}

function moveWeek(amount) {
  /*
    Move the displayed week by whole weeks.
    Preserve the selected weekday when possible.
  */
  weekStart = addDays(weekStart, amount * 7);
  selectedWeekDate = addDays(selectedWeekDate, amount * 7);

  syncSelectedDateToWeek();
  renderWeek();
}

/* ========================================
   ADD AND EDIT TASKS
======================================== */

function resetTaskForm() {
  editingId = null;
  $("#taskForm").reset();
  $("#submitTask").textContent = "＋ Add task";
  $("#cancelEdit").classList.add("hidden");
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = $("#taskTitle").value.trim();

  if (!title) {
    $("#taskTitle").focus();
    return;
  }

  const category = $("#taskCategory").value;
  const due = $("#taskDue").value;

  if (!categories[category]) {
    showToast("Please choose a valid category.");
    return;
  }

  if (due && !parseDate(due)) {
    showToast("Please choose a valid due date.");
    return;
  }

  if (editingId) {
    const task = tasks.find(item => item.id === editingId);

    if (!task) {
      resetTaskForm();
      showToast("Task not found. Please try again.");
      return;
    }

    task.title = title;
    task.category = category;
    task.due = due;

    showToast("Task updated! ✨");
  } else {
    tasks.unshift({
      id: makeId(),
      title,
      category,
      due,
      completed: false,
      xpAwarded: false,
      createdAt: Date.now()
    });

    showToast("Task added! You can do this 🌷");
  }

  saveTasks();
  resetTaskForm();
  renderAll();
}

function beginEdit(id) {
  const task = tasks.find(item => item.id === id);

  if (!task) return;

  editingId = id;

  $("#taskTitle").value = task.title;
  $("#taskCategory").value = task.category;
  $("#taskDue").value = task.due;

  $("#submitTask").textContent = "Save changes";
  $("#cancelEdit").classList.remove("hidden");

  $("#taskForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  $("#taskTitle").focus({ preventScroll: true });
}

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);

  if (!task) return;

  if (!confirm(`Delete "${task.title}"?`)) return;

  tasks = tasks.filter(item => item.id !== id);

  if (editingId === id) {
    resetTaskForm();
  }

  saveTasks();
  renderAll();
  showToast("Task deleted.");
}

function toggleTask(id, completed) {
  const task = tasks.find(item => item.id === id);

  if (!task || task.completed === completed) return;

  task.completed = completed;

  if (completed && !task.xpAwarded) {
    task.xpAwarded = true;
    totalXP += XP_PER_TASK;
    saveXP();

    showToast(`Task completed! +${XP_PER_TASK} XP ⭐`);
  } else if (completed) {
    showToast("Task completed! Another little win 💗");
  } else {
    /*
      Earned XP stays earned when a task is unchecked.
      The task can be completed again without duplicate XP.
    */
    showToast("Task moved back to your to-do list.");
  }

  saveTasks();
  renderAll();
}

function clearCompletedTasks() {
  const completedCount = tasks.filter(task => task.completed).length;

  if (!completedCount) {
    showToast("No completed tasks to clear yet.");
    return;
  }

  if (!confirm(
    `Clear ${completedCount} completed task(s)? Your earned XP will stay.`
  )) {
    return;
  }

  tasks = tasks.filter(task => !task.completed);

  if (editingId && !tasks.some(task => task.id === editingId)) {
    resetTaskForm();
  }

  saveTasks();
  renderAll();
  showToast("Completed tasks cleared. XP kept ⭐");
}

/* ========================================
   LIGHT AND DARK THEMES
======================================== */

function setTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  document.documentElement.dataset.theme = safeTheme;

  $("#themeToggle").textContent =
    safeTheme === "dark" ? "☀️" : "🌙";

  $("#themeToggle").setAttribute(
    "aria-label",
    safeTheme === "dark"
      ? "Switch to light mode"
      : "Switch to dark mode"
  );
}

function toggleTheme() {
  const nextTheme =
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

  setTheme(nextTheme);
  saveJSON(KEYS.theme, nextTheme);
}

/* ========================================
   DAILY MOTIVATIONAL QUOTES
======================================== */

function showRandomQuote() {
  const current = $("#quoteText").textContent;
  const choices = quotes.filter(quote => quote !== current);

  const pool = choices.length ? choices : quotes;

  $("#quoteText").textContent =
    pool[Math.floor(Math.random() * pool.length)];
}

/* ========================================
   MOOD AND ENERGY CHECK-IN
======================================== */

function loadMood() {
  const saved = loadJSON(KEYS.mood, null);

  if (!saved || saved.date !== dateKey(new Date())) {
    selectedMood = null;
    $("#moodSaved").textContent = "";
    return;
  }

  selectedMood = saved.mood || null;

  const energy = Math.min(
    5,
    Math.max(1, Number(saved.energy) || 3)
  );

  $("#energyLevel").value = String(energy);
  $("#energyValue").textContent = `${energy} / 5`;
  $("#moodNote").value = saved.note || "";

  document.querySelectorAll(".mood-option").forEach(button => {
    const selected = button.dataset.mood === selectedMood;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  $("#moodSaved").textContent = "Today's check-in is saved 💗";
}

function saveMood() {
  const entry = {
    date: dateKey(new Date()),
    mood: selectedMood,
    energy: Number($("#energyLevel").value),
    note: $("#moodNote").value.trim()
  };

  if (saveJSON(KEYS.mood, entry)) {
    $("#moodSaved").textContent =
      "Check-in saved. Be kind to yourself today 💗";

    showToast("Your check-in is saved 💕");
  }
}

/* ========================================
   RENDER ALL UPDATED SECTIONS
======================================== */

function renderAll() {
  renderStats();
  renderTasks();
  renderWeek();
}

/* ========================================
   EVENT LISTENERS
======================================== */

function init() {
  $("#todayLabel").textContent = new Date().toLocaleDateString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric"
    }
  );

  const savedTheme = loadJSON(KEYS.theme, "light");

  setTheme(savedTheme === "dark" ? "dark" : "light");

  $("#quoteText").textContent =
    quotes[Math.floor(Math.random() * quotes.length)];

  /* Task form */
  $("#taskForm").addEventListener("submit", handleTaskSubmit);
  $("#cancelEdit").addEventListener("click", resetTaskForm);

  /* Search */
  $("#taskSearch").addEventListener("input", renderTasks);

  /* Filters */
  document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;

      document.querySelectorAll(".filter-button").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderTasks();
    });
  });

  /* Task completion */
  $("#taskList").addEventListener("change", event => {
    if (!event.target.matches(".task-check")) return;

    const card = event.target.closest(".task-item");

    if (card) {
      toggleTask(card.dataset.id, event.target.checked);
    }
  });

  /* Task edit and delete */
  $("#taskList").addEventListener("click", event => {
    const card = event.target.closest(".task-item");

    if (!card) return;

    if (event.target.closest(".edit-task")) {
      beginEdit(card.dataset.id);
    } else if (event.target.closest(".delete-task")) {
      deleteTask(card.dataset.id);
    }
  });

  /* Clear completed tasks */
  $("#clearCompleted").addEventListener("click", clearCompletedTasks);

  /* Theme */
  $("#themeToggle").addEventListener("click", toggleTheme);

  /* Quotes */
  $("#newQuote").addEventListener("click", showRandomQuote);

  /* Weekly planner: select a date */
  $("#weekDays").addEventListener("click", event => {
    const button = event.target.closest(".day-button");

    if (!button) return;

    const chosenDate = parseDate(button.dataset.date);

    if (!chosenDate) return;

    selectedWeekDate = chosenDate;

    /*
      The clicked date already belongs to the displayed week.
      Only the selection changes; weekStart stays Monday.
    */
    renderWeek();
  });

  /* Weekly planner: previous week */
  $("#prevWeek").addEventListener("click", () => {
    moveWeek(-1);
  });

  /* Weekly planner: next week */
  $("#nextWeek").addEventListener("click", () => {
    moveWeek(1);
  });

  /* Mood selection */
  $("#moodOptions").addEventListener("click", event => {
    const button = event.target.closest(".mood-option");

    if (!button) return;

    selectedMood = button.dataset.mood;

    document.querySelectorAll(".mood-option").forEach(item => {
      const selected = item === button;

      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
  });

  /* Energy slider */
  $("#energyLevel").addEventListener("input", event => {
    $("#energyValue").textContent = `${event.target.value} / 5`;
  });

  /* Save check-in */
  $("#saveMood").addEventListener("click", saveMood);

  loadMood();
  renderAll();
}

/* ========================================
   START APPLICATION
======================================== */

init();
