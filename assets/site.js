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

  /* ---- Laundering desk: a pile of cash bundles that grows with a total ----
     RR.pile(el) returns { update(total, goal, opts) }. Each bundle is a round amount picked so
     the goal fills about 48 bundles; up to 64 are drawn. New bundles drop onto the desk. */
  RR.pile = function (root) {
    var COLS = 8, ROWS = 8, MAX = COLS * ROWS;
    var fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
    root.classList.add("pile");
    root.innerHTML = '<div class="pile-stage"><div class="pile-bills"></div><div class="pile-desk"></div><span class="pile-more" hidden></span><span class="pile-empty">Your cash lands here as you log runs</span></div><div class="pile-cap"><span class="pile-unit"></span><span class="pile-count"></span></div>';
    var billsEl = root.querySelector(".pile-bills"), desk = root.querySelector(".pile-desk");
    var moreEl = root.querySelector(".pile-more"), emptyEl = root.querySelector(".pile-empty");
    var unitEl = root.querySelector(".pile-unit"), countEl = root.querySelector(".pile-count");
    // Fill order: low layers first, centre stacks before the edges, so it grows into a mound
    var order = [];
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) order.push({ c: c, r: r, k: r + Math.abs(c - (COLS - 1) / 2) * 0.8 + ((c * 7) % 3) * 0.03 });
    order.sort(function (a, b) { return a.k - b.k; });
    function rnd(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
    var bills = [], unit = 0;
    function niceUnit(goal) {
      var raw = Math.max(1000, goal / 48), steps = [1, 2, 2.5, 5], p = Math.pow(10, Math.floor(Math.log10(raw)));
      for (var i = 0; i < 8; i++) { for (var j = 0; j < steps.length; j++) { var v = steps[j] * p; if (v >= raw * 0.8) return v; } p *= 10; }
      return raw;
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
        var end = "translateX(" + b._jx + "px) rotate(" + b._rot + "deg)";
        b.animate([
          { transform: "translate(" + b._jx + "px, -150px) rotate(" + (b._rot * 6) + "deg)", opacity: 0 },
          { transform: "translate(" + b._jx + "px, 3px) rotate(" + b._rot + "deg)", opacity: 1, offset: 0.78 },
          { transform: end, opacity: 1 }
        ], { duration: 520, delay: delay, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)", fill: "backwards" });
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
        var u = niceUnit(goal > 0 ? goal : 1000000);
        if (u !== unit) {
          // Goal changed enough to change the bundle size: redraw quietly instead of re-dropping everything
          if (unit) animate = false;
          while (bills.length) dropBill(0, false);
          unit = u;
        }
        var exact = total / unit;
        var want = total > 0 ? Math.max(1, Math.min(MAX, Math.floor(exact))) : 0;
        var have = bills.length, step = opts.fast ? 16 : 45;
        if (want > have) {
          var n = want - have;
          for (var i = 0; i < n; i++) addBill(have + i, Math.min(i * step, 1100), animate);
          if (animate && !reduce) {
            clearTimeout(thudTimer);
            thudTimer = setTimeout(function () { desk.classList.remove("thud"); void desk.offsetWidth; desk.classList.add("thud"); }, Math.min((n - 1) * step, 1100) + 400);
          }
        } else if (want < have) {
          for (var k = 0; k < have - want; k++) dropBill(k * 25, animate);
        }
        var extra = Math.floor(exact) - MAX;
        moreEl.hidden = extra <= 0;
        if (extra > 0) moreEl.textContent = "+" + fmt.format(extra) + " more";
        emptyEl.hidden = total > 0;
        unitEl.innerHTML = "Each bundle is <b>$" + fmt.format(unit) + "</b>";
        countEl.innerHTML = total > 0 ? "<b>" + fmt.format(Math.floor(exact)) + "</b> " + (Math.floor(exact) === 1 ? "bundle" : "bundles") + (goal > 0 ? ", goal is " + fmt.format(Math.round(goal / unit)) : "") : "";
        root.classList.toggle("done", goal > 0 && total >= goal);
      }
    };
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

  function init() { initNav(); initJump(); initTop(); initSlash(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
