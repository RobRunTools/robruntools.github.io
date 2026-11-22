/* Shared behaviour for every page: nav highlight, section jump bar, collapsibles,
   back-to-top, toasts and the money count-up. Exposed as window.RR for page scripts. */
(function () {
  "use strict";
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* ignore */ }
  var RR = window.RR = window.RR || {};
  RR.reduceMotion = reduce;

  function navH() {
    var n = document.querySelector(".nav");
    return n ? n.getBoundingClientRect().height : 0;
  }
  function jumpH() {
    var j = document.querySelector(".jump");
    return j && getComputedStyle(j).position === "sticky" ? j.getBoundingClientRect().height : 0;
  }

  /* ---- Toast ---- */
  var toastEl, toastTimer;
  RR.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(function () { toastEl.classList.add("show"); });
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  };

  /* ---- Small attention helpers ---- */
  function restartClass(el, cls) {
    if (!el || reduce) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener("animationend", function done() { el.classList.remove(cls); el.removeEventListener("animationend", done); });
  }
  RR.flash = function (el) { restartClass(el, "flash"); };
  RR.pop = function (el) { restartClass(el, "pop"); };
  RR.tick = function (el) { restartClass(el, "tick"); };

  /* ---- Sliding thumb: the orange pill glides to whichever option is on (toggles, section bar) ---- */
  var thumbs = [];
  function addThumb(box, itemSel, isOn, cls) {
    if (box._rrThumb) return;
    var t = document.createElement("span");
    t.className = cls;
    t.setAttribute("aria-hidden", "true");
    box.insertBefore(t, box.firstChild);
    box._rrThumb = t;
    var placed = false;
    function update() {
      var on = null;
      [].forEach.call(box.querySelectorAll(itemSel), function (b) { if (!on && isOn(b) && !b.hidden && b.offsetWidth) on = b; });
      if (!on) { box.classList.remove("thumb-on"); placed = false; return; }
      if (!placed) t.style.transition = "none";
      t.style.width = on.offsetWidth + "px";
      t.style.height = on.offsetHeight + "px";
      t.style.transform = "translate(" + on.offsetLeft + "px, " + on.offsetTop + "px)";
      if (!placed) { void t.offsetWidth; t.style.transition = ""; placed = true; }
      box.classList.add("thumb-on");
    }
    if (window.MutationObserver) new MutationObserver(update).observe(box, { attributes: true, subtree: true, attributeFilter: ["aria-pressed", "aria-current", "hidden"] });
    if (window.ResizeObserver) new ResizeObserver(update).observe(box);
    thumbs.push({ box: box, update: update });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    update();
  }
  function scanThumbs(root) {
    [].forEach.call((root || document).querySelectorAll(".seg"), function (sg) {
      addThumb(sg, "button", function (b) { return b.getAttribute("aria-pressed") === "true"; }, "seg-thumb");
    });
  }
  window.addEventListener("resize", function () {
    thumbs = thumbs.filter(function (x) { return x.box.isConnected; });
    thumbs.forEach(function (x) { x.update(); });
  });

  /* ---- Count-up for money figures ---- */
  RR.countUp = function (el, to, opts) {
    opts = opts || {};
    var format = opts.format || function (n) { return Math.round(n).toLocaleString("en-US"); };
    var from = typeof opts.from === "number" ? opts.from : 0;
    if (el._rrRaf) cancelAnimationFrame(el._rrRaf);
    if (reduce || from === to || !isFinite(to)) { el.textContent = format(to); return; }
    var dur = opts.duration || Math.min(1100, 450 + Math.log10(Math.abs(to - from) + 10) * 90);
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (to - from) * e);
      if (p < 1) el._rrRaf = requestAnimationFrame(step); else el._rrRaf = null;
    }
    el._rrRaf = requestAnimationFrame(step);
  };

  /* ---- Laundering desk: a pile of cash that grows toward a goal ----
     RR.pile(el) returns { update(total, goal, opts) }. A full desk (48 bundles) is your goal and it
     keeps stacking past it up to 64. The curve is gentle (power 0.7) so smaller cuts still put a
     few more bundles on the desk than a straight line would. */
  RR.pile = function (root) {
    var COLS = 8, ROWS = 8, MAX = COLS * ROWS, FULL = 48;
    var fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
    root.classList.add("pile");
    root.innerHTML = '<div class="pile-stage"><div class="pile-bills"></div><div class="pile-desk"></div><span class="pile-empty">Your cash lands here as you log runs</span></div><div class="pile-cap"><span class="pile-unit"></span><span class="pile-count"></span></div>';
    var billsEl = root.querySelector(".pile-bills"), desk = root.querySelector(".pile-desk");
    var emptyEl = root.querySelector(".pile-empty"), unitEl = root.querySelector(".pile-unit"), countEl = root.querySelector(".pile-count");
    var order = [];
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) order.push({ c: c, r: r, k: r + Math.abs(c - (COLS - 1) / 2) * 0.8 + ((c * 7) % 3) * 0.03 });
    order.sort(function (a, b) { return a.k - b.k; });
    function rnd(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
    var bills = [], lastGoal = null;
    function bundlesFor(total, goal) {
      if (!(total > 0)) return 0;
      var g = goal > 0 ? goal : 1000000;
      return Math.max(2, Math.min(MAX, Math.round(FULL * Math.pow(total / g, 0.7))));
    }
    function place(b, i) {
      var o = order[i], w = 100 / COLS;
      b.style.left = "calc(" + (o.c * w) + "% + 2px)";
      b.style.width = "calc(" + w + "% - 4px)";
      b.style.bottom = (o.r * 18) + "px";
      b._jx = Math.round((rnd(i) - 0.5) * 6);
      b._rot = ((rnd(i + 99) - 0.5) * 3).toFixed(2);
      b.style.transform = "translateX(" + b._jx + "px) rotate(" + b._rot + "deg)";
      b.style.zIndex = String(o.r * 10 + 5);
    }
    function addBill(i, delay, animate) {
      var b = document.createElement("span");
      b.className = "bill";
      place(b, i);
      billsEl.appendChild(b);
      bills.push(b);
      if (animate && !reduce && b.animate) {
        b.animate([
          { transform: "translate(" + b._jx + "px, -160px) rotate(" + (b._rot * 6) + "deg)", opacity: 0 },
          { transform: "translate(" + b._jx + "px, 3px) rotate(" + b._rot + "deg)", opacity: 1, offset: 0.78 },
          { transform: "translateX(" + b._jx + "px) rotate(" + b._rot + "deg)", opacity: 1 }
        ], { duration: 540, delay: delay, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)", fill: "backwards" });
      }
    }
    function dropBill(delay, animate) {
      var b = bills.pop();
      if (!b) return;
      if (animate && !reduce && b.animate) {
        var a = b.animate([{ opacity: 1 }, { transform: "translate(" + b._jx + "px, -40px) rotate(" + (b._rot * 4) + "deg)", opacity: 0 }], { duration: 320, delay: delay, easing: "ease-in", fill: "forwards" });
        a.onfinish = function () { b.remove(); };
      } else b.remove();
    }
    var thudTimer;
    return {
      update: function (total, goal, opts) {
        opts = opts || {};
        var animate = opts.animate !== false;
        if (lastGoal !== null && goal !== lastGoal) animate = false; // goal edits redraw quietly
        lastGoal = goal;
        var want = bundlesFor(total, goal), have = bills.length, step = opts.fast ? 18 : 45;
        if (want > have) {
          var n = want - have;
          for (var i = 0; i < n; i++) addBill(have + i, Math.min(i * step, 1100), animate);
          if (animate && !reduce) {
            clearTimeout(thudTimer);
            thudTimer = setTimeout(function () { desk.classList.remove("thud"); void desk.offsetWidth; desk.classList.add("thud"); }, Math.min((n - 1) * step, 1100) + 420);
          }
        } else if (want < have) {
          for (var k = 0; k < have - want; k++) dropBill(k * 25, animate);
        }
        emptyEl.hidden = total > 0;
        var g2 = goal > 0 ? goal : 0;
        unitEl.innerHTML = g2 ? "A full desk is your goal, <b>$" + fmt.format(g2) + "</b>" : "";
        var pct = g2 ? total / g2 * 100 : 0;
        countEl.innerHTML = !total ? "" : !g2 ? "" : pct >= 100 ? (pct >= 150 ? "<b>" + (total / g2).toFixed(1) + "x</b> your goal" : "<b>Goal hit</b>") : "<b>" + Math.floor(pct) + "%</b> there";
        root.classList.toggle("done", g2 > 0 && total >= g2);
      }
    };
  };

  /* ---- Rubber stamp that lands on an element for a milestone ---- */
  RR.stamp = function (host, text, tone) {
    if (!host) return;
    var old = host.querySelector(".stamp");
    if (old) old.remove();
    var s = document.createElement("span");
    s.className = "stamp" + (tone ? " " + tone : "");
    s.setAttribute("aria-hidden", "true");
    s.textContent = text;
    host.appendChild(s);
    setTimeout(function () { s.classList.add("out"); }, reduce ? 2600 : 2900);
    setTimeout(function () { s.remove(); }, reduce ? 3000 : 3500);
  };

  /* ---- Wipe clock ----
     Every server (the game calls them states) is raided 7 days after it opened, then it closes and you pick a
     new state from prison. The game shows SERVER LIFETIME (time since it opened) in the main menu and a
     "Federal raid in" countdown. One fresh server opens daily per region: EU at 5 PM UTC, East US at 8 PM
     New York time (Kefir, Nov 4), plus extras whenever servers fill up. Saved on this device only. */
  var WEEK = 7 * 864e5, WIPE_KEY = "robrun-wipe-v1";
  var REGIONS = {
    eu: { name: "EU", tz: "UTC", hour: 17, when: "5 PM UTC" },
    us: { name: "East US", tz: "America/New_York", hour: 20, when: "8 PM New York time" }
  };
  var tzFmt = {};
  function tzOffset(ms, tz) { // minutes the zone is ahead of UTC at that instant
    try {
      var f = tzFmt[tz] || (tzFmt[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }));
      var p = {};
      f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return (Date.UTC(+p.year, p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 6e4;
    } catch (e) { return tz === "UTC" ? 0 : -300; }
  }
  function zoned(y, m, d, h, tz) { // instant of a wall-clock hour in a time zone
    var guess = Date.UTC(y, m, d, h), t = guess - tzOffset(guess, tz) * 6e4;
    return guess - tzOffset(t, tz) * 6e4;
  }
  function openings(region, now) { // newest first, from tomorrow back 8 days
    var r = REGIONS[region], wall = new Date(now + tzOffset(now, r.tz) * 6e4), out = [];
    for (var k = -1; k <= 8; k++) out.push(zoned(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - k, r.hour, r.tz));
    return out;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function parts(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }
  RR.fmtLeft = function (ms) {
    var p = parts(ms);
    if (p.d) return p.d + "d " + p.h + "h";
    if (p.h) return p.h + "h " + p.m + "m";
    return p.m ? p.m + "m" : "under a minute";
  };
  RR.fmtClock = function (ms) {
    var p = parts(ms);
    return (p.d ? p.d + "d " : "") + two(p.h) + ":" + two(p.m) + ":" + two(p.s);
  };
  RR.whenLocal = function (t, now) {
    var d = new Date(t), n = new Date(now || Date.now());
    var time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    var day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return day + ", " + time;
  };
  RR.whenSaid = function (t, now) { // for the middle of a sentence: "yesterday at 7:00 PM", "on Thu, Nov 19 at 7:00 PM"
    var w = RR.whenLocal(t, now), day = w.slice(0, w.lastIndexOf(", ")), time = w.slice(w.lastIndexOf(", ") + 2);
    return (/^(Today|Tomorrow|Yesterday)$/.test(day) ? day.toLowerCase() : "on " + day) + " at " + time;
  };
  function timeOnly(t) { return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

  RR.wipe = {
    WEEK: WEEK,
    regions: REGIONS,
    nextOpen: function (region, now) {
      now = now || Date.now();
      return Math.min.apply(null, openings(region, now).filter(function (t) { return t > now; }));
    },
    recentOpens: function (region, now) {
      now = now || Date.now();
      return openings(region, now).filter(function (t) { return t <= now && t > now - WEEK; });
    },
    load: function () {
      try { var s = JSON.parse(localStorage.getItem(WIPE_KEY) || "null"); return s && s.at > 0 && isFinite(s.at) ? s : null; } catch (e) { return null; }
    },
    get: function (now) {
      now = now || Date.now();
      var s = RR.wipe.load();
      if (!s) return null;
      var raided = s.at <= now;
      return { at: s.at, last: raided ? s.at : null, raided: raided, left: Math.max(0, s.at - now), how: s.how, region: s.region };
    },
    set: function (at, how, region) {
      try { localStorage.setItem(WIPE_KEY, JSON.stringify({ at: at, how: how, region: region || null, set: Date.now() })); } catch (e) { /* ignore */ }
      wipeChanged();
    },
    clear: function () {
      try { localStorage.removeItem(WIPE_KEY); } catch (e) { /* ignore */ }
      wipeChanged();
    }
  };

  var clocks = [], tickTimer = null, lastAt, wasRaided = null;
  function wipeChanged() {
    var g = RR.wipe.get();
    lastAt = g ? g.at : null;
    wasRaided = g ? g.raided : null;
    clocks.forEach(function (c) { c.render(); });
    document.dispatchEvent(new CustomEvent("rr-wipe"));
  }
  function tickAll() {
    var now = Date.now(), g = RR.wipe.get(now), raided = !!(g && g.raided);
    if (g && wasRaided === false && raided) {
      wasRaided = true;
      clocks.forEach(function (c) { c.render(); });
      document.dispatchEvent(new CustomEvent("rr-wipe", { detail: { wiped: g.at } }));
      RR.toast("Federal Raid. Your server was just raided.");
      return;
    }
    wasRaided = g ? raided : null;
    lastAt = g ? g.at : null;
    clocks.forEach(function (c) { c.tick(now, g); });
  }
  window.addEventListener("storage", function (e) { if (e.key === WIPE_KEY) wipeChanged(); });

  var sheet = null, uid = 0;
  function buildSetter(onDone, opts) {
    opts = opts || {};
    var id = "ws" + (++uid), g = RR.wipe.get();
    var f = document.createElement("form");
    f.className = "setter";
    f.noValidate = true;
    f.innerHTML =
      '<div class="seg set-mode" role="group" aria-label="How to set it">' +
        '<button type="button" data-mode="lifetime">Server lifetime</button><button type="button" data-mode="timer">Time left</button><button type="button" data-mode="open">Opened at</button></div>' +
      '<div class="set-pane" data-pane="dhm">' +
        '<div class="dhm">' +
          '<div class="field"><label for="' + id + 'd">Days</label><input type="text" inputmode="numeric" autocomplete="off" id="' + id + 'd" name="d" placeholder="0" maxlength="2"></div>' +
          '<div class="field"><label for="' + id + 'h">Hours</label><input type="text" inputmode="numeric" autocomplete="off" id="' + id + 'h" name="h" placeholder="0" maxlength="2"></div>' +
          '<div class="field"><label for="' + id + 'm">Minutes</label><input type="text" inputmode="numeric" autocomplete="off" id="' + id + 'm" name="m" placeholder="0" maxlength="2"></div>' +
        '</div>' +
        '<p class="hint set-dhm-hint"></p>' +
      '</div>' +
      '<div class="set-pane" data-pane="open" hidden>' +
        '<div class="seg set-region" role="group" aria-label="Region"><button type="button" data-region="us">East US</button><button type="button" data-region="eu">EU</button></div>' +
        '<div class="field"><label for="' + id + 'o">Your server opened</label><select id="' + id + 'o" name="open"></select></div>' +
        '<p class="hint set-region-hint"></p>' +
      '</div>' +
      '<p class="hint bad set-err" role="alert" hidden></p>' +
      '<div class="set-acts"><button type="submit" class="btn primary">Start the clock</button>' +
        (opts.cancel ? '<button type="button" class="btn ghost" data-act="cancel">Cancel</button>' : "") +
        (g ? '<button type="button" class="btn ghost" data-act="off">Turn off clock</button>' : "") + "</div>";
    var mode = g && (g.how === "open" || g.how === "timer") ? g.how : "lifetime", region = g && g.region === "eu" ? "eu" : "us";
    var err = f.querySelector(".set-err"), sel = f.querySelector("select");
    function fillOpens() {
      var now = Date.now();
      sel.innerHTML = RR.wipe.recentOpens(region, now).map(function (t) {
        return '<option value="' + t + '">' + RR.whenLocal(t, now) + " (wipes in " + RR.fmtLeft(t + WEEK - now) + ")</option>";
      }).join("");
      var r = REGIONS[region], next = RR.wipe.nextOpen(region, now);
      f.querySelector(".set-region-hint").textContent = "The daily " + r.name + " server opens at " + r.when + " (" + timeOnly(next) + " for you). Most servers open at other times when the others fill up, so only use this if your crew joined a fresh daily one.";
    }
    function show() {
      [].forEach.call(f.querySelectorAll(".set-mode button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });
      [].forEach.call(f.querySelectorAll(".set-region button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.region === region)); });
      f.querySelector('[data-pane="dhm"]').hidden = mode === "open";
      f.querySelector('[data-pane="open"]').hidden = mode !== "open";
      f.querySelector(".set-dhm-hint").textContent = mode === "lifetime"
        ? "Main menu, bottom right above RUN. It counts up from when your server opened, like 3D 19H."
        : "From the Federal raid in countdown in game.";
      if (mode === "open") fillOpens();
      err.hidden = true;
    }
    f.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.mode) { mode = b.dataset.mode; show(); }
      else if (b.dataset.region) { region = b.dataset.region; show(); }
      else if (b.dataset.act === "cancel") onDone(false);
      else if (b.dataset.act === "off") { RR.wipe.clear(); RR.toast("Wipe clock turned off"); onDone(true); }
    });
    f.addEventListener("input", function (e) {
      if (e.target.tagName === "INPUT") e.target.value = e.target.value.replace(/\D+/g, "");
      err.hidden = true;
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var at;
      if (mode !== "open") {
        var d = +f.elements.d.value || 0, h = +f.elements.h.value || 0, m = +f.elements.m.value || 0;
        var ms = ((d * 24 + h) * 60 + m) * 6e4;
        if (h > 23 || m > 59) { err.textContent = "Hours go up to 23 and minutes up to 59."; err.hidden = false; return; }
        if (mode === "timer" && !(ms > 0)) { err.textContent = "Put in the time left, like 2 days 5 hours."; err.hidden = false; f.elements.d.focus(); return; }
        if (mode === "lifetime" && !f.elements.d.value && !f.elements.h.value && !f.elements.m.value) { err.textContent = "Put in your Server lifetime, like 3 days 19 hours."; err.hidden = false; f.elements.d.focus(); return; }
        if (mode === "lifetime" && ms >= WEEK) { err.textContent = "At 7 days the server gets raided, so the lifetime has to be under that."; err.hidden = false; return; }
        if (ms > WEEK) { err.textContent = "Servers only last 7 days, so the timer can't be longer than that."; err.hidden = false; return; }
        at = mode === "lifetime" ? Date.now() + WEEK - ms : Date.now() + ms;
      } else {
        at = Number(sel.value) + WEEK;
        if (!(at > Date.now())) { err.textContent = "Pick the day your server opened."; err.hidden = false; return; }
      }
      RR.wipe.set(at, mode, mode === "open" ? region : null);
      RR.toast("Wipe clock set: " + RR.whenLocal(at));
      onDone(true);
    });
    show();
    return f;
  }
  function closeSheet() { if (!sheet) return; if (sheet.close) sheet.close(); else sheet.removeAttribute("open"); }
  RR.openWipeSetter = function () {
    if (!sheet) {
      sheet = document.createElement("dialog");
      sheet.className = "sheet";
      sheet.setAttribute("aria-labelledby", "sheetTitle");
      document.body.appendChild(sheet);
      sheet.addEventListener("click", function (e) { if (e.target === sheet) closeSheet(); });
    }
    sheet.innerHTML = '<h2 class="panel-title" id="sheetTitle">Set your wipe clock</h2><p class="sheet-sub">Every server wipes 7 days after it opened, at the same hour.</p>';
    sheet.appendChild(buildSetter(closeSheet, { cancel: true }));
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
    var first = sheet.querySelector('input, select');
    if (first && first.offsetParent) first.focus();
  };

  /* RR.wipeClock(el, { compact, cut }) mounts the countdown. cut() returns your cut so the last-day
     warning can say how much is at stake. */
  RR.wipeClock = function (root, opts) {
    opts = opts || {};
    var compact = !!opts.compact, refs = {}, srvNext = {};
    function cutLine(g) {
      var cut = opts.cut ? opts.cut() : 0;
      var money = cut > 0 ? "$" + Math.round(cut).toLocaleString("en-US") : "";
      if (g.left < 36e5) return money ? "Under an hour left. Spend your " + money + " cut now." : "Under an hour left. Spend everything now.";
      return money ? "Under a day left. Spend your " + money + " cut before the feds take it." : "Under a day left. Cash in the bank goes in the raid, so spend it.";
    }
    function render() {
      var now = Date.now(), g = RR.wipe.get(now);
      root.classList.toggle("is-set", !!g);
      if (compact) {
        root.className = "wipe-line" + (g ? " is-set" : "");
        root.innerHTML = g && g.raided
          ? '<span class="wl-dot" aria-hidden="true"></span><span class="wl-text">Your server was raided ' + RR.whenSaid(g.at, now) + '.</span><button type="button" class="linkish" data-act="set">Set the clock for your new one</button>'
          : g
          ? '<span class="wl-dot" aria-hidden="true"></span><span class="wl-text">Federal Raid in <b class="wl-left"></b></span><button type="button" class="linkish" data-act="set">Change</button>'
          : '<span class="wl-dot" aria-hidden="true"></span><span class="wl-text">When does your server wipe?</span><button type="button" class="linkish" data-act="set">Set the wipe clock</button>';
        root.classList.toggle("raided", !!(g && g.raided));
      } else {
        root.classList.add("clock");
        var servers = '<div class="clock-servers"><span class="label">New servers open</span>' +
          ["us", "eu"].map(function (r) { return '<div class="srv" data-r="' + r + '"><b>' + REGIONS[r].name + '</b><span class="srv-left"></span><small class="srv-at"></small></div>'; }).join("") +
          '<p class="srv-note">A fresh server gives you the full 7 days. Extra ones open whenever the others fill up.</p></div>';
        if (g && g.raided) {
          root.innerHTML = '<div class="clock-main">' +
            '<div class="clock-head"><span class="label">Federal Raid on your server</span></div>' +
            '<div class="clock-raided">Raided</div>' +
            '<p class="clock-sub">Your server was raided ' + RR.whenSaid(g.at, now) + ' and closed. Escape your cell, pick a new state, then set the clock for it.</p>' +
            '<div class="set-acts"><button type="button" class="btn primary" data-act="set">Set the clock for my new server</button></div></div>' + servers;
        } else if (g) {
          root.innerHTML = '<div class="clock-main">' +
            '<div class="clock-head"><span class="label">Federal Raid on your server</span><button type="button" class="linkish" data-act="set">Change</button></div>' +
            '<div class="clock-time" role="timer"></div>' +
            '<div class="clock-fuse" aria-hidden="true"><i></i><b class="spark"></b></div>' +
            '<div class="clock-meta"><span class="clock-day"></span><span class="clock-when"></span></div>' +
            '<p class="clock-msg" hidden></p></div>' + servers;
        } else {
          root.innerHTML = '<div class="clock-main"><span class="label">Wipe clock</span>' +
            '<h2 class="clock-ask">When does your server wipe?</h2>' +
            '<p class="clock-sub">Set it once and it counts down here and on the split page, and warns you on the last day.</p>' +
            '<div class="clock-setter"></div></div>' + servers;
          root.querySelector(".clock-setter").appendChild(buildSetter(function () { /* render runs on change */ }));
        }
      }
      ["wl-left", "clock-time", "clock-fuse", "clock-day", "clock-when", "clock-msg"].forEach(function (k) { refs[k] = root.querySelector("." + k); });
      srvNext = {};
      api.tick(now, g, true);
    }
    var api = {
      render: render,
      tick: function (now, g, first) {
        if (g && g.raided) {
          root.classList.add("soon");
          root.classList.remove("urgent");
        } else if (g) {
          var soon = g.left < 864e5, urgent = g.left < 36e5;
          root.classList.toggle("soon", soon);
          root.classList.toggle("urgent", urgent);
          if (compact) {
            refs["wl-left"].textContent = RR.fmtClock(g.left);
          } else {
            var p = parts(g.left), ct = refs["clock-time"];
            if (!ct._b) {
              ct.innerHTML = '<span class="cg"><b></b><i>d</i></span><span class="cg"><b></b><i>h</i></span><span class="cg"><b></b><i>m</i></span><span class="cg"><b></b><i>s</i></span>';
              ct._b = ct.querySelectorAll("b");
            }
            ct._b[0].parentNode.hidden = !p.d;
            [String(p.d), two(p.h), two(p.m), two(p.s)].forEach(function (v, i) {
              var b = ct._b[i];
              if (b.textContent === v) return;
              var had = b.textContent !== "";
              b.textContent = v;
              if (had && i < 3 && !first) restartClass(b, "roll");
            });
            refs["clock-time"].setAttribute("aria-label", "Wipes in " + RR.fmtLeft(g.left));
            var w = Math.max(0, Math.min(100, g.left / WEEK * 100)).toFixed(3) + "%";
            refs["clock-fuse"].firstChild.style.width = w;
            refs["clock-fuse"].lastChild.style.left = w;
            refs["clock-day"].textContent = "Day " + Math.min(7, Math.max(1, Math.floor((WEEK - g.left) / 864e5) + 1)) + " of 7";
            var ws = "Wipes " + RR.whenSaid(g.at, now);
            if (refs["clock-when"].textContent !== ws) refs["clock-when"].textContent = ws;
            var msg = soon ? cutLine(g) : "";
            refs["clock-msg"].hidden = !msg;
            if (refs["clock-msg"].textContent !== msg) refs["clock-msg"].textContent = msg;
          }
        } else {
          root.classList.remove("soon", "urgent");
        }
        if (!compact) {
          ["us", "eu"].forEach(function (r) {
            if (!srvNext[r] || srvNext[r] <= now) srvNext[r] = RR.wipe.nextOpen(r, now);
            var row = root.querySelector('.srv[data-r="' + r + '"]');
            if (!row) return;
            row.querySelector(".srv-left").textContent = "in " + RR.fmtLeft(srvNext[r] - now);
            row.querySelector(".srv-at").textContent = RR.whenLocal(srvNext[r], now);
          });
        }
      }
    };
    root.addEventListener("click", function (e) {
      var b = e.target.closest('[data-act="set"]');
      if (b) RR.openWipeSetter();
    });
    clocks.push(api);
    render();
    if (!tickTimer) { var g0 = RR.wipe.get(); lastAt = g0 ? g0.at : null; wasRaided = g0 ? g0.raided : null; tickTimer = setInterval(tickAll, 1000); }
    return api;
  };

  /* ---- Smooth scroll to an element, clearing the sticky bars ---- */
  RR.scrollTo = function (target) {
    if (!target) return;
    var y = target.getBoundingClientRect().top + window.pageYOffset - navH() - jumpH() - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
  };

  /* ---- Animated <details class="acc"> ---- */
  function bodyOf(det) {
    var kids = det.children;
    for (var i = 0; i < kids.length; i++) if (kids[i].tagName !== "SUMMARY") return kids[i];
    return null;
  }
  RR.setOpen = function (det, open, animate) {
    if (!det || det.open === open && !det._rrAnim) return;
    var body = bodyOf(det);
    det._rrTarget = open;
    if (det._rrAnim) { det._rrAnim.cancel(); det._rrAnim = null; }
    if (!body || reduce || animate === false || !body.animate) { det.open = open; return; }
    body.style.overflow = "hidden";
    if (open) {
      det.open = true;
      var h = body.scrollHeight;
      det._rrAnim = body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: Math.min(420, 180 + h * 0.25), easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    } else {
      var hc = body.scrollHeight;
      det._rrAnim = body.animate([{ height: hc + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: Math.min(320, 160 + hc * 0.18), easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
    }
    det._rrAnim.onfinish = function () {
      if (!open) det.open = false;
      body.style.overflow = "";
      det._rrAnim = null;
      det.dispatchEvent(new CustomEvent("rr-toggled"));
    };
  };
  document.addEventListener("click", function (e) {
    var sum = e.target.closest("details.acc > summary");
    if (!sum || e.target.closest("a, button:not(summary)")) return;
    e.preventDefault();
    var det = sum.parentElement;
    RR.setOpen(det, det._rrAnim ? !det._rrTarget : !det.open);
  });

  /* ---- Top bar: sliding highlight that follows the pointer ---- */
  function initNav() {
    var links = document.querySelector(".nav-links");
    if (!links) return;
    var pill = document.createElement("span");
    pill.className = "nav-pill";
    pill.setAttribute("aria-hidden", "true");
    links.insertBefore(pill, links.firstChild);
    var current = links.querySelector('a[aria-current="page"]');
    function moveTo(a, show) {
      if (!a || getComputedStyle(a).display === "none") { pill.style.opacity = "0"; return; }
      pill.style.left = a.offsetLeft + "px";
      pill.style.width = a.offsetWidth + "px";
      pill.style.opacity = show ? "1" : "0";
    }
    var noAnim = function (fn) { var t = pill.style.transition; pill.style.transition = "none"; fn(); void pill.offsetWidth; pill.style.transition = t; };
    noAnim(function () { moveTo(current, !!current); });
    [].forEach.call(links.querySelectorAll("a"), function (a) {
      a.addEventListener("mouseenter", function () { moveTo(a, true); });
      a.addEventListener("focus", function () { moveTo(a, true); });
    });
    links.addEventListener("mouseleave", function () { moveTo(current, !!current); });
    window.addEventListener("resize", function () { noAnim(function () { moveTo(current, !!current); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { noAnim(function () { moveTo(current, !!current); }); });
  }

  /* ---- Jump bar: smooth scroll + highlight the section you're in ---- */
  function initJump() {
    var bar = document.querySelector(".jump");
    if (!bar) return;
    var links = [].slice.call(bar.querySelectorAll('a[href^="#"]'));
    function targetOf(a) { return document.getElementById(a.getAttribute("href").slice(1)); }
    function visible(el) { return el && !el.closest("[hidden]") && el.getClientRects().length > 0; }
    function sync() {
      links.forEach(function (a) { var hide = !visible(targetOf(a)); if (a.hidden !== hide) a.hidden = hide; });
    }
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var t = targetOf(a);
        if (!t) return;
        e.preventDefault();
        if (t.tagName === "DETAILS" && !t.open) RR.setOpen(t, true, false);
        RR.scrollTo(t);
        if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
        try { t.focus({ preventScroll: true }); } catch (er) { /* ignore */ }
      });
    });
    var ticking = false;
    function spy() {
      ticking = false;
      var line = navH() + jumpH() + 40, active = null;
      links.forEach(function (a) {
        if (a.hidden) return;
        var t = targetOf(a);
        if (t && t.getBoundingClientRect().top <= line) active = a;
      });
      if (!active) active = links.filter(function (a) { return !a.hidden; })[0] || null;
      if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 4) {
        var vis = links.filter(function (a) { return !a.hidden; });
        if (vis.length) active = vis[vis.length - 1];
      }
      links.forEach(function (a) {
        if (a === active) {
          if (a.getAttribute("aria-current") !== "true") {
            a.setAttribute("aria-current", "true");
            var l = a.offsetLeft - 24, r = a.offsetLeft + a.offsetWidth + 24;
            if (l < bar.scrollLeft) bar.scrollTo({ left: l, behavior: reduce ? "auto" : "smooth" });
            else if (r > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: r - bar.clientWidth, behavior: reduce ? "auto" : "smooth" });
          }
        } else a.removeAttribute("aria-current");
      });
      bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= navH() + 1 && window.pageYOffset > 10);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    RR.refreshJump = function () { sync(); spy(); };
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (recs) {
        if (recs.every(function (r) { return bar.contains(r.target); })) return;
        sync(); onScroll();
      });
      mo.observe(document.querySelector("main") || document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true, childList: true });
    }
    sync(); spy();
  }

  /* ---- Back to top ---- */
  function initTop() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "to-top";
    b.setAttribute("aria-label", "Back to top");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    b.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });
    document.body.appendChild(b);
    var on = false;
    function check() {
      var show = window.pageYOffset > Math.max(700, window.innerHeight * 0.9);
      if (show !== on) { on = show; b.classList.toggle("show", show); }
    }
    window.addEventListener("scroll", check, { passive: true });
    check();
  }

  /* ---- Press / to jump into the page's search box ---- */
  function initSlash() {
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var a = document.activeElement;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      var s = document.querySelector("[data-slash]");
      if (!s || !s.getClientRects().length) return;
      e.preventDefault();
      s.focus();
      if (s.select) s.select();
    });
  }

  /* ---- If the browser showed an old cached copy of this page, quietly load the new one once ---- */
  function checkFresh() {
    try {
      var me = document.querySelector('script[src*="site.js?v="]');
      var v = me && (me.getAttribute("src").match(/v=(\w+)/) || [])[1];
      if (!v || !window.fetch) return;
      var key = "rr-fresh:" + location.pathname;
      fetch(location.pathname, { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
        var m = html.match(/assets\/site\.js\?v=(\w+)/);
        if (!m) return;
        if (m[1] === v) { sessionStorage.removeItem(key); return; }
        if (sessionStorage.getItem(key) === m[1]) return;
        sessionStorage.setItem(key, m[1]);
        location.reload();
      }).catch(function () { /* offline: keep what we have */ });
    } catch (e) { /* ignore */ }
  }

  function init() {
    initNav(); initJump(); initTop(); initSlash();
    scanThumbs();
    var jb = document.querySelector(".jump");
    if (jb) addThumb(jb, 'a[href^="#"]', function (a) { return a.getAttribute("aria-current") === "true"; }, "jump-thumb");
    if (window.MutationObserver) {
      var pend = false;
      new MutationObserver(function (recs) {
        if (pend) return;
        for (var i = 0; i < recs.length; i++) if (recs[i].addedNodes.length) { pend = true; break; }
        if (pend) requestAnimationFrame(function () { pend = false; scanThumbs(); });
      }).observe(document.body, { childList: true, subtree: true });
    }
    if (location.protocol.indexOf("http") === 0) setTimeout(checkFresh, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
