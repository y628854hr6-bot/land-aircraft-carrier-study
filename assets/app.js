/* Fundamentals of Flying Vehicle Technology (2026) — Assignment 1 (Joby S4)
 * Wing-Borne vs Hover Physics Simulator, Air Taxi Unit Economics & Competitor Chart
 */

(function () {
  'use strict';

  function isEn() { return document.body.classList.contains('E'); }
  function t(cn, en) { return isEn() ? en : cn; }

  function prepareCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.parentElement ? canvas.parentElement.clientWidth : 520;
    if (width < 260) width = 260;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.height = cssHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: width, h: cssHeight };
  }

  window.toggleLang = function () {
    var en = document.body.classList.toggle('E');
    var btn = document.getElementById('langBtn');
    if (btn) btn.textContent = en ? '中文' : 'EN';
    document.documentElement.lang = en ? 'en' : 'zh-CN';
    try { localStorage.setItem('fv_joby_res_lang', en ? 'E' : 'C'); } catch (e) {}
    updatePhysicsSim();
    updateEconomicsCalc();
    drawCompetitorChart();
  };

  window.toggleNav = function () {
    var links = document.querySelector('.lab-nav-links');
    if (links) links.classList.toggle('open');
  };

  document.addEventListener('click', function (ev) {
    var link = ev.target.closest('.lab-nav-links a');
    if (link && !link.closest('.lab-lang-switch')) {
      var menu = document.querySelector('.lab-nav-links');
      if (menu) menu.classList.remove('open');
    }
  });

  function setupScrollSpy() {
    var bar = document.getElementById('readingProgress');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.fv-toc a'));
    var sections = tocLinks.map(function (a) {
      var id = a.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.getElementById(id.slice(1)) : null;
    }).filter(Boolean);

    function onScroll() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      if (bar && height > 0) bar.style.width = Math.min(100, Math.max(0, (scrollTop / height) * 100)).toFixed(1) + '%';
      var currentId = '';
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= 120) currentId = sections[i].id;
      }
      tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href').slice(1) === currentId); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  window.filterEvidence = function (category, btnEl) {
    document.querySelectorAll('#evidenceFilterBar .fv-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btnEl) btnEl.classList.add('active');
    document.querySelectorAll('#evidenceMatrixTable tbody tr').forEach(function (row) {
      var tags = (row.getAttribute('data-tags') || '').split(',');
      row.classList.toggle('is-hidden', category !== 'all' && tags.indexOf(category) === -1);
    });
  };

  /* Powered-Lift Cruise vs Hover Physics Simulator */
  var SIM_DEFAULTS = { mtow: 2400, usableKwh: 115, ld: 14, cruiseKmh: 280 };

  function calcPoweredLift(mtowKg, usableKwh, ld, cruiseKmh) {
    var g = 9.80665, rho = 1.225;
    var W = mtowKg * g;
    /* 6 tilt-rotors approx radius ~1.45 m -> disk area = 6*pi*1.45^2 ~ 39.6 m^2 */
    var area = 6 * Math.PI * 1.45 * 1.45;
    var pHoverKw = (Math.pow(W, 1.5) / Math.sqrt(2 * rho * area)) / (0.74 * 0.88 * 1000);
    /* Wing-borne cruise power = (W * V) / (L/D * eta_prop * eta_elec) */
    var vMs = cruiseKmh / 3.6;
    var pCruiseKw = (W * vMs) / (ld * 0.84 * 0.90 * 1000);
    /* Deduct ~3 min hover takeoff/landing (~pHoverKw * 3/60) before cruise range */
    var hoverEnergyKwh = pHoverKw * (3 / 60);
    var cruiseEnergyKwh = Math.max(0, usableKwh - hoverEnergyKwh);
    var cruiseHours = cruiseEnergyKwh / pCruiseKw;
    var rangeKm = cruiseHours * cruiseKmh;
    return { pHoverKw: pHoverKw, pCruiseKw: pCruiseKw, rangeKm: rangeKm, ratio: pHoverKw / pCruiseKw };
  }

  function updatePhysicsSim() {
    var mtowEl = document.getElementById('simMtow');
    if (!mtowEl) return;
    var mtow = Number(mtowEl.value);
    var usableKwh = Number(document.getElementById('simKwh').value);
    var ld = Number(document.getElementById('simLd').value);
    var cruiseKmh = Number(document.getElementById('simSpeed').value);

    document.getElementById('valMtow').textContent = mtow + ' kg';
    document.getElementById('valKwh').textContent = usableKwh + ' kWh';
    document.getElementById('valLd').textContent = ld.toFixed(1);
    document.getElementById('valSpeed').textContent = cruiseKmh + ' km/h';

    var res = calcPoweredLift(mtow, usableKwh, ld, cruiseKmh);
    document.getElementById('outHoverPower').textContent = res.pHoverKw.toFixed(0) + ' kW';
    document.getElementById('outCruisePower').textContent = res.pCruiseKw.toFixed(0) + ' kW';
    document.getElementById('outRangeKm').textContent = res.rangeKm.toFixed(0) + ' km';
    document.getElementById('outPowerRatio').textContent = res.ratio.toFixed(1) + '× (' + t('悬停/巡航比', 'Hover/Cruise') + ')';

    drawRangeCurve(mtow, usableKwh, ld, cruiseKmh);
  }

  function drawRangeCurve(curMtow, usableKwh, ld, cruiseKmh) {
    var canvas = document.getElementById('physicsCurveCanvas');
    var p = prepareCanvas(canvas, 230);
    if (!p) return;
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);

    var pad = { l: 50, r: 22, t: 28, b: 36 };
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

    for (var yVal = 0; yVal <= 280; yVal += 70) {
      var gy = pad.t + ph - (yVal / 280) * ph;
      ctx.strokeStyle = '#e4e8ec';
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = '#5c6270'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'right';
      ctx.fillText(yVal + 'km', pad.l - 6, gy + 4);
    }

    var y161 = pad.t + ph - (161 / 280) * ph;
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#9a5b13';
    ctx.beginPath(); ctx.moveTo(pad.l, y161); ctx.lineTo(w - pad.r, y161); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#9a5b13'; ctx.font = '10.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(t('161 km (100 mi) 含备份目标航程', '161 km (100 mi) Target Range'), pad.l + 6, y161 - 5);

    var minM = 2000, maxM = 2700;
    [2000, 2200, 2400, 2600].forEach(function (mVal) {
      var x = pad.l + ((mVal - minM) / (maxM - minM)) * pw;
      ctx.strokeStyle = '#e4e8ec';
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.fillStyle = '#5c6270'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(mVal + 'kg', x, h - pad.b + 16);
    });

    function plotCurve(ldVal, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var m = minM; m <= maxM; m += 25) {
        var r = calcPoweredLift(m, usableKwh, ldVal, cruiseKmh);
        var x = pad.l + ((m - minM) / (maxM - minM)) * pw;
        var y = pad.t + ph - (Math.min(280, r.rangeKm) / 280) * ph;
        if (m === minM) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    plotCurve(ld, '#182542');
    plotCurve(Math.max(9, ld - 3), '#6e7b99');

    var curX = pad.l + ((curMtow - minM) / (maxM - minM)) * pw;
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#283e6e';
    ctx.beginPath(); ctx.moveTo(curX, pad.t); ctx.lineTo(curX, h - pad.b); ctx.stroke(); ctx.restore();

    ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    var cLbl = '● ' + t('当前 L/D 航程', 'Current L/D');
    var lLbl = '● ' + t('高阻降级 (L/D-3)', 'Degraded L/D-3');
    var cW = ctx.measureText(cLbl).width;
    ctx.fillStyle = '#182542'; ctx.fillText(cLbl, w - pad.r, 16);
    ctx.fillStyle = '#6e7b99'; ctx.fillText(lLbl, w - pad.r - cW - 18, 16);
  }

  window.resetPhysicsSim = function () {
    document.getElementById('simMtow').value = SIM_DEFAULTS.mtow;
    document.getElementById('simKwh').value = SIM_DEFAULTS.usableKwh;
    document.getElementById('simLd').value = SIM_DEFAULTS.ld;
    document.getElementById('simSpeed').value = SIM_DEFAULTS.cruiseKmh;
    updatePhysicsSim();
  };

  /* Air Taxi Fleet Unit Economics Calculator */
  function updateEconomicsCalc() {
    var capexEl = document.getElementById('ecoCapex');
    if (!capexEl) return;
    var capexUsdM = Number(capexEl.value); // $M USD
    var hrsDay = Number(document.getElementById('ecoHours').value);
    var loadPax = Number(document.getElementById('ecoLoad').value);
    var farePerKm = Number(document.getElementById('ecoFare').value); // $/seat-km

    document.getElementById('valEcoCapex').textContent = capexUsdM.toFixed(1) + 'M USD';
    document.getElementById('valEcoHours').textContent = hrsDay.toFixed(1) + (isEn() ? ' h/day' : ' h/日');
    document.getElementById('valEcoLoad').textContent = loadPax.toFixed(1) + (isEn() ? ' PAX' : ' 人/架次');
    document.getElementById('valEcoFare').textContent = farePerKm.toFixed(2) + ' USD/km';

    /* 300 active days/yr, effective block speed ~210 km/h (including vertical/taxi) */
    var annualFlightKm = hrsDay * 300 * 210;
    var annualRevUsd = annualFlightKm * loadPax * farePerKm;
    /* OpEx: pilot + maintenance + battery replacement + energy + vertiport + 7yr linear depreciation */
    var annualDep = (capexUsdM * 1e6) / 7;
    var annualOpex = annualDep + 320000 + (hrsDay * 300 * 280);
    var annualProfit = annualRevUsd - annualOpex;
    var costPerSeatKm = annualOpex / (annualFlightKm * loadPax);

    document.getElementById('outEcoRev').textContent = (annualRevUsd / 1e6).toFixed(2) + 'M USD/yr';
    document.getElementById('outEcoCostKm').textContent = costPerSeatKm.toFixed(2) + ' USD/seat-km';
    document.getElementById('outEcoNet').textContent =
      (annualProfit >= 0 ? '+' : '') + (annualProfit / 1e6).toFixed(2) + 'M USD/yr';
  }

  /* Competitor Bubble Chart */
  var COMPETITORS = [
    { id: 'joby', cn: 'Joby S4 (倾转旋翼)', en: 'Joby S4 (Tilt-rotor)', rangeKm: 161, certScore: 84, roadScore: 5, color: '#182542' },
    { id: 'eh216', cn: '亿航 EH216-S', en: 'EHang EH216-S', rangeKm: 30, certScore: 98, roadScore: 10, color: '#0f3b38' },
    { id: 'lac', cn: '小鹏汇天 陆地航母', en: 'ARIDGE Land Carrier', rangeKm: 25, certScore: 68, roadScore: 95, color: '#173b4d' },
    { id: 'govy', cn: '广汽高域 GOVY AirCab', en: 'GAC GOVY AirCab', rangeKm: 30, certScore: 55, roadScore: 15, color: '#416d7e' },
    { id: 'aircar', cn: 'Klein Vision AirCar', en: 'Klein Vision AirCar', rangeKm: 1000, certScore: 48, roadScore: 72, color: '#6b7280' },
    { id: 'alef', cn: 'Alef Model A', en: 'Alef Model A', rangeKm: 177, certScore: 22, roadScore: 65, color: '#8e2424' }
  ];

  function drawCompetitorChart() {
    var canvas = document.getElementById('competitorCanvas');
    var p = prepareCanvas(canvas, 300);
    if (!p) return;
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);

    var pad = { l: 60, r: 30, t: 36, b: 48 };
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.fillStyle = '#f8f9fc'; ctx.fillRect(pad.l, pad.t, pw, ph);

    ctx.strokeStyle = '#e1e4ed'; ctx.lineWidth = 1;
    [25, 50, 75, 100].forEach(function (v) {
      var gx = pad.l + (v / 100) * pw, gy = pad.t + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(gx, pad.t); ctx.lineTo(gx, h - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = '#5c6270'; ctx.font = '10.5px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.fillText(v + '%', gx, h - pad.b + 16);
      ctx.textAlign = 'right'; ctx.fillText(v + '%', pad.l - 8, gy + 4);
    });
    ctx.strokeStyle = '#9aa5ae'; ctx.strokeRect(pad.l, pad.t, pw, ph);

    ctx.fillStyle = '#182542'; ctx.font = 'bold 11.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t('道路耦合便利度指数 →', 'Road Mobility & Coupling Index →'), pad.l + pw / 2, h - 10);
    ctx.save(); ctx.translate(16, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('适航取证与商业化落地确定性 →', 'Certification & Commercial Readiness →'), 0, 0); ctx.restore();

    COMPETITORS.forEach(function (c) {
      var x = pad.l + (c.roadScore / 100) * pw, y = pad.t + ph - (c.certScore / 100) * ph;
      var r = 8 + Math.log10(Math.max(10, c.rangeKm)) * 5.0;
      ctx.globalAlpha = 0.22; ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#111214'; ctx.font = 'bold 11px sans-serif';
      var label = (isEn() ? c.en : c.cn) + ' (' + c.rangeKm + 'km)';
      if (c.id === 'aircar') {
        ctx.textAlign = 'right'; ctx.fillText(label, w - pad.r - 4, y + r + 16);
      } else {
        var alignRight = x > pad.l + pw * 0.6;
        ctx.textAlign = alignRight ? 'right' : 'left';
        ctx.fillText(label, alignRight ? x - r - 7 : x + r + 7, y + 4);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (localStorage.getItem('fv_joby_res_lang') === 'E') {
        document.body.classList.add('E'); document.documentElement.lang = 'en';
        var btn = document.getElementById('langBtn'); if (btn) btn.textContent = '中文';
      }
    } catch (e) {}
    setupScrollSpy();
    ['simMtow', 'simKwh', 'simLd', 'simSpeed'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', updatePhysicsSim);
    });
    ['ecoCapex', 'ecoHours', 'ecoLoad', 'ecoFare'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', updateEconomicsCalc);
    });
    updatePhysicsSim(); updateEconomicsCalc(); drawCompetitorChart();
    window.addEventListener('resize', function () { updatePhysicsSim(); drawCompetitorChart(); });
  });
})();
