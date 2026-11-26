// ---------- sources: the progress file (months, kpi) and the daily store (data/kpi/daily)
dash.loader('months', {description: 'Lấy phần "months" (mỗi kỳ, kèm trung bình đến kỳ đó) trong file tiến độ.', fn: ({answer}) => answer.months});
dash.loader('kpi', {description: 'Lấy phần "kpi" (ba chỉ số của mỗi kỳ) trong file tiến độ.', fn: ({answer}) => answer.kpi});

dash.calc('selm', {
  inputs: ['months'],
  title: 'Kỳ đang xem',
  description: 'Dòng của kỳ chọn ở thanh "Chọn kỳ"; chưa chọn thì là kỳ đang chạy.',
  fn: (months) => {
    const want = dash.params().month;
    const row = months.find((r) => r.month === want) || months.find((r) => r.running === true) || months[months.length - 1];
    return row ? [row] : [];
  }
});

dash.calc('sel', {
  inputs: ['selm', 'kpi'],
  title: 'Ba chỉ số của kỳ đang xem',
  description: 'Tái tục, doanh thu mới, học viên mới của kỳ chọn ở thanh "Chọn kỳ".',
  fn: (selm, kpi) => (selm.length ? kpi.filter((r) => r.month === selm[0].month) : [])
});

dash.calc('selday', {
  inputs: ['selm', 'daily'],
  title: 'Doanh thu mới theo ngày của kỳ đang xem',
  description: 'Đường cộng dồn của kỳ đang xem, nhịp đều và trung bình các kỳ trước trong năm ở cùng ngày.',
  fn: (selm, daily) => {
    const row = selm[0];
    if (!row) return [];
    const list = (x) => (Array.isArray(x) ? x : (typeof x === 'string' && x ? JSON.parse(x) : []));
    const yes = (x) => x === true || x === 'true';
    const me = daily.find((d) => d.month === row.month);
    const prior = daily.filter((d) => String(d.month) < row.month && String(d.month).slice(0, 4) === String(row.month).slice(0, 4) && yes(d.final));
    const mine = me ? list(me.sales) : [];
    const [y, m] = String(row.month).split('-').map(Number);
    const out = [];
    for (let i = 0; i < row.total_days; i++) {
      const dt = new Date(Date.UTC(y, m - 1, 6 + i));
      const ps = prior.map((d) => list(d.sales)).filter((s) => s.length).map((s) => s[Math.min(i, s.length - 1)]);
      out.push({
        day: i + 1,
        date: dt.toISOString().slice(0, 10),
        label: String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0'),
        sales: i < mine.length ? mine[i] : null,
        pace: Math.round(1000 * (i + 1) / row.total_days) / 10,
        prior_avg: ps.length ? Math.round(10 * ps.reduce((a, b) => a + b, 0) / ps.length) / 10 : null,
        prior_n: ps.length
      });
    }
    return out;
  }
});

dash.calc('dayx', {
  inputs: ['selday'],
  title: 'So với các kỳ trước ở cùng ngày',
  description: 'Ngày cuối có số liệu của kỳ đang xem, so với trung bình các kỳ trước ở cùng ngày.',
  fn: (selday) => {
    const done = selday.filter((r) => r.sales != null), last = done[done.length - 1];
    if (!last) return [];
    const s = Math.round(last.sales), p = last.prior_avg == null ? null : Math.round(last.prior_avg);
    return [{day: last.day, label: last.label, sales: s, prior_avg: p, prior_n: last.prior_n, diff: p == null ? null : s - p}];
  }
});

// ---------- helpers
window.kp = (function () {
  const C = {g: '#BA3638', gd: '#8E2728', ink: '#1F2937', slate: '#6C757D', hair: '#E6E8EE', grid: 'rgba(50,60,95,.07)', tint: 'rgba(50,60,95,.08)', band: 'rgba(50,60,95,.07)',
    d: '#323C5F', d2: '#5B6585', d3: '#7B84A0', track: '#E9EBF1', tick: '#D5D9E3', pace: '#ADB5BD'};
  const ink = (r) => (r && r.tone === 'bad' ? C.g : C.d);
  const fmt = (x, d) => (x == null || isNaN(x)) ? '—' : Number(x).toLocaleString('vi-VN', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0});
  const signed = (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 0));
  function still() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } }
  function rows(src) { const r = dash.data(src); return r.status === 'ok' && Array.isArray(r.data) ? r.data : null; }
  function row(el) {
    const r = rows(el.dataset.source);
    if (!r) return null;
    if (el.dataset.row != null) return r[+el.dataset.row] || null;
    const w = el.dataset.where || '', i = w.indexOf('=');
    if (i < 0) return null;
    const k = decodeURIComponent(w.slice(0, i)), v = decodeURIComponent(w.slice(i + 1));
    return r.find((x) => String(x[k]) === v) || null;
  }
  function selMonth() { const s = rows('selm'); return s && s[0] ? s[0].month : null; }
  function pick(m) { if (m && m !== selMonth()) dash.setParams({month: m}); }
  function tip(el) {
    const t = document.createElement('div');
    t.className = 'eo-tip';
    t.hidden = true;
    el.appendChild(t);
    return {
      show(lines, x, y) {
        t.replaceChildren(...lines.map((s, i) => { const d = document.createElement('div'); d.textContent = s; if (i === 0) d.className = 'eo-tip-h'; return d; }));
        t.hidden = false;
        const W = el.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        let left = x + 12;
        if (left + tw > W) left = Math.max(0, x - tw - 12);
        t.style.left = left + 'px';
        t.style.top = Math.max(0, y - th - 10) + 'px';
      },
      hide() { t.hidden = true; }
    };
  }
  function ready(el, src) {
    const s = dash.data(src).status;
    if (s === 'ok') return true;
    el.replaceChildren();
    el.textContent = s === 'error' ? 'Không tải được dữ liệu cho phần này.' : '—';
    return false;
  }
  function tone(r) { return !r ? 'neutral' : (r.pct != null && r.pct >= r.target) ? 'done' : r.tone; }
  function arc(cx, cy, r, a0, a1) {
    const p = (a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
    const s = p(a0), e = p(a1);
    return `M${s[0].toFixed(2)},${s[1].toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e[0].toFixed(2)},${e[1].toFixed(2)}`;
  }
  function textW(sel) { let m = 0; sel.each(function () { m = Math.max(m, this.getComputedTextLength()); }); return m; }
  function grid(svg, y, x0, x1, f, n) {
    const g = svg.append('g');
    y.ticks(n || 4).forEach((v) => {
      g.append('line').attr('x1', x0).attr('x2', x1).attr('y1', y(v)).attr('y2', y(v)).style('stroke', C.grid);
      g.append('text').attr('x', x0 - 8).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end').text(f(v));
    });
  }
  function xLabels(svg, items, x, y0, on) {
    const step = items.length > 1 ? Math.abs(x(items[1].k) - x(items[0].k)) : 99;
    const every = step < 46 ? Math.ceil(46 / step) : 1;
    items.forEach((it, i) => {
      if ((items.length - 1 - i) % every && it.k !== on) return;
      svg.append('text').attr('class', it.k === on ? 'eo-on' : null).attr('x', x(it.k)).attr('y', y0).attr('text-anchor', 'middle').text(it.label);
    });
  }
  return {C, ink, fmt, signed, still, rows, row, selMonth, pick, tip, ready, tone, arc, textW, grid, xLabels};
})();

// ---------- what shows: running vs closed cycle, short vs met, averages present
dash.onData(() => {
  const root = document.getElementById('kp-root');
  if (!root) return;
  const all = (q, fn) => root.querySelectorAll(q).forEach(fn);
  const sm = kp.rows('selm'), m = sm && sm[0];
  if (m) {
    const run = m.running === true;
    all('[data-show="run"]', (el) => { el.hidden = !run; });
    all('[data-show="done"]', (el) => { el.hidden = run; });
    all('[data-show="ytd"]', (el) => { el.hidden = !(m.ytd_n > 0); });
    all('[data-show="noytd"]', (el) => { el.hidden = m.ytd_n > 0; });
    all('[data-show="cmp"]', (el) => { el.hidden = !(m.prior_n > 0); });
    all('[data-show="chg"]', (el) => { el.hidden = m.avg_change_pct == null; });
  }
  const sl = kp.rows('sel') || [];
  all('[data-show][data-kpi]', (el) => {
    const r = sl.find((x) => x.kpi === el.dataset.kpi);
    if (!r) return;
    const met = r.pct != null && r.pct >= r.target;
    if (el.dataset.show === 'short') el.hidden = met;
    else if (el.dataset.show === 'met') el.hidden = !met;
  });
  const dx = kp.rows('dayx');
  if (dx) {
    const d0 = dx[0];
    all('[data-show="day"]', (el) => { el.hidden = !d0; });
    all('[data-show="noday"]', (el) => { el.hidden = !!d0; });
    all('[data-show="dayavg"]', (el) => { el.hidden = !(d0 && d0.prior_n > 0); });
  }
});

// ---------- text drawings
dash.draw('f', (el) => {
  const r = kp.row(el), v = r ? r[el.dataset.field] : null, f = el.dataset.fmt;
  let t;
  if (v == null) t = '—';
  else if (typeof v === 'number') t = kp.fmt(v, f === '2' ? 2 : f === '1' ? 1 : 0);
  else { t = String(v); if (f === 'lc') t = t.charAt(0).toLowerCase() + t.slice(1); }
  el.textContent = t;
});

// numbers that count to their new value when the cycle changes
dash.draw('num', {
  mount: () => ({v: null}),
  update: (el, st) => {
    const r = kp.row(el), v = r ? r[el.dataset.field] : null, dec = el.dataset.fmt === '2' ? 2 : el.dataset.fmt === '1' ? 1 : 0;
    d3.select(el).interrupt();
    if (typeof v !== 'number') { el.textContent = '—'; st.v = null; return; }
    const from = st.v;
    st.v = v;
    if (kp.still() || from === v) { el.textContent = kp.fmt(v, dec); return; }
    const i = d3.interpolateNumber(from == null ? 0 : from, v);
    d3.select(el).transition().duration(700).ease(d3.easeCubicOut).tween('text', () => (t) => { el.textContent = kp.fmt(i(t), dec); });
  }
});

dash.draw('sign', (el) => {
  const r = kp.row(el), v = r ? r[el.dataset.field] : null;
  el.textContent = kp.signed(v);
  el.className = v == null ? '' : (v >= 0 ? 'eo-up' : 'eo-dn');
});

dash.draw('pill', (el) => {
  const r = kp.row(el);
  el.textContent = r ? r.status : '—';
  el.className = (el.dataset.base || 'eo-pill') + ' ' + kp.tone(r);
});

dash.draw('chg', (el) => {
  const r = kp.row(el), v = r ? r[el.dataset.field] : null;
  el.textContent = kp.signed(v);
  el.className = v == null ? '' : (v >= 0 ? 'eo-up' : 'eo-dn');
});

// ---------- month picker: segmented control with a sliding white pill, grouped by year; arrow keys move between cycles
dash.draw('months', {
  mount: (el) => {
    const st = {key: ''};
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const bs = [...el.querySelectorAll('button')], i = bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
      const n = bs[Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      if (n) { e.preventDefault(); n.focus(); kp.pick(n.dataset.m); }
    });
    return st;
  },
  update: (el, st) => {
    const ms = kp.rows('months');
    if (!ms) { if (!st.key) el.textContent = '—'; return; }
    const cur = kp.selMonth(), key = ms.map((r) => r.month + (r.running ? '*' : '')).join(',');
    if (key !== st.key) {
      st.key = key;
      el.replaceChildren();
      st.ind = document.createElement('span');
      st.ind.className = 'eo-ms-ind';
      st.ind.setAttribute('aria-hidden', 'true');
      el.appendChild(st.ind);
      let yr = null;
      ms.forEach((r) => {
        if (r.year !== yr) { yr = r.year; const y = document.createElement('span'); y.className = 'yr'; y.textContent = String(yr); el.appendChild(y); }
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.m = r.month;
        b.textContent = r.short;
        if (r.running) b.className = 'run';
        b.setAttribute('aria-label', r.label + (r.running ? ', đang chạy' : ', đã chốt'));
        b.addEventListener('click', () => kp.pick(r.month));
        el.appendChild(b);
      });
      st.first = true;
    }
    let on = null;
    el.querySelectorAll('button').forEach((b) => { const yes = b.dataset.m === cur; b.setAttribute('aria-pressed', String(yes)); if (yes) on = b; });
    if (!on) return;
    const move = () => { st.ind.style.width = on.offsetWidth + 'px'; st.ind.style.transform = `translateX(${on.offsetLeft}px)`; };
    if (st.first) { st.ind.style.transition = 'none'; move(); void st.ind.offsetWidth; st.ind.style.transition = ''; st.first = false; } else move();
    const l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < el.scrollLeft || r > el.scrollLeft + el.clientWidth) {
      try { el.scrollTo({left: Math.max(0, l - (el.clientWidth - on.offsetWidth) / 2), behavior: kp.still() ? 'auto' : 'smooth'}); } catch (e) { el.scrollLeft = Math.max(0, l - (el.clientWidth - on.offsetWidth) / 2); }
    }
  }
});

// ---------- ring gauge (hero): 270° arc that sweeps to the new value, pace tick on a running cycle, white dot at the target
dash.draw('dial', {
  mount: (el) => {
    const c = 100, R = 80, W = 10;
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 200 200').attr('width', '100%').attr('height', '100%').attr('role', 'img');
    const st = {svg, prev: null, r: null};
    svg.append('path').attr('d', kp.arc(c, c, R, -135, 135)).style('fill', 'none').style('stroke', kp.C.track).style('stroke-width', W).style('stroke-linecap', 'round');
    st.val = svg.append('path').style('fill', 'none').style('stroke', kp.C.d).style('stroke-width', W).style('stroke-linecap', 'round');
    st.over = svg.append('path').style('fill', 'none').style('stroke', kp.C.d2).style('stroke-width', 3).style('stroke-linecap', 'round');
    st.paceW = svg.append('line').style('stroke', '#fff').style('stroke-width', 7).style('stroke-linecap', 'round');
    st.paceG = svg.append('line').style('stroke', kp.C.ink).style('stroke-width', 2.5).style('stroke-linecap', 'round');
    st.tgt = svg.append('circle').attr('r', 4).style('fill', kp.C.ink);
    st.tip = kp.tip(el);
    svg.on('pointermove pointerdown', (ev) => {
      const r = st.r;
      if (!r) return;
      const [px, py] = d3.pointer(ev, el);
      st.tip.show([r.label, `Đạt ${kp.fmt(r.pct, 0)}%`].concat(r.final ? [] : [`Nhịp cần có hôm nay ${kp.fmt(r.pace, 0)}%`]).concat([`Mục tiêu ${kp.fmt(r.target, 0)}%`]), px, py);
    }).on('pointerleave', () => st.tip.hide());
    st.paint = (v) => {
      const ang = (x) => -135 + 270 * Math.max(0, Math.min(x, 100)) / 100;
      const pt = (rad, a) => [c + rad * Math.sin(a * Math.PI / 180), c - rad * Math.cos(a * Math.PI / 180)];
      st.val.attr('d', v.pct > 0.3 ? kp.arc(c, c, R, -135, Math.max(-134.5, ang(v.pct))) : null);
      st.over.attr('d', v.pct > 100.3 ? kp.arc(c, c, R + W / 2 + 8, -135, Math.max(-134.5, ang(v.pct - 100))) : null);
      const a = ang(v.pace), p0 = pt(R - W / 2 - 5, a), p1 = pt(R + W / 2 + 5, a), vis = v.run && v.pace > 0 ? 'visible' : 'hidden';
      [st.paceW, st.paceG].forEach((l) => l.attr('x1', p0[0]).attr('y1', p0[1]).attr('x2', p1[0]).attr('y2', p1[1]).attr('visibility', vis));
      const tp = pt(R + W / 2 + 9, ang(v.target));
      st.tgt.attr('cx', tp[0]).attr('cy', tp[1]);
    };
    return st;
  },
  update: (el, st) => {
    const s = kp.rows('sel'), r = s ? s.find((x) => x.kpi === el.dataset.kpi) : null;
    st.r = r;
    st.val.style('stroke', kp.ink(r));
    const to = r ? {pct: r.pct || 0, pace: r.pace || 0, target: r.target || 100, run: !r.final} : {pct: 0, pace: 0, target: 100, run: false};
    st.svg.attr('aria-label', r ? `${r.label}: đạt ${kp.fmt(r.pct, 0)}%, mục tiêu ${kp.fmt(r.target, 0)}%` : 'Đang tải');
    const from = st.prev || {pct: 0, pace: 0, target: to.target, run: to.run};
    st.prev = to;
    st.svg.interrupt();
    if (kp.still() || (from.pct === to.pct && from.pace === to.pace && from.target === to.target && from.run === to.run)) { st.paint(to); return; }
    const it = d3.interpolateObject(from, to);
    st.svg.transition().duration(800).ease(d3.easeCubicOut).tween('dial', () => (t) => st.paint(it(t)));
  }
});

// ---------- cycle timeline (hero): one tick per day; the white run and the dot glide to the new day
dash.draw('timeline', {
  mount: () => ({f: null, n: 0, W: 0}),
  update: (el, st) => {
    const sm = kp.rows('selm'), c = sm && sm[0];
    if (!c) { el.replaceChildren(); el.textContent = '—'; st.f = null; return; }
    const W = Math.max(200, el.clientWidth), H = 28, x0 = 7, x1 = W - 7, n = c.total_days || 1, e = c.elapsed_days || 0;
    const x = (d) => x0 + (x1 - x0) * d / n;
    if (W !== st.W || n !== st.n || !st.svg) {
      el.replaceChildren();
      st.W = W; st.n = n;
      st.svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
      st.ticks = [];
      for (let d = 0; d <= n; d++) st.ticks.push(st.svg.append('line').attr('x1', x(d)).attr('x2', x(d)).attr('y1', 9).attr('y2', 19).style('stroke-width', d === 0 || d === n ? 2 : 1.2));
      st.run = st.svg.append('line').attr('x1', x0).attr('y1', 14).attr('y2', 14).style('stroke', kp.C.d).style('stroke-width', 3).style('stroke-linecap', 'round');
      st.dot = st.svg.append('circle').attr('cy', 14).attr('r', 7).style('fill', kp.C.d);
      st.core = st.svg.append('circle').attr('cy', 14).attr('r', 2.6).style('fill', '#fff');
      st.svg.append('path').attr('d', `M${x1},7 L${x1 + 6},14 L${x1},21 L${x1 - 6},14 Z`).style('fill', 'none').style('stroke', kp.C.d).style('stroke-width', 1.5);
    }
    st.svg.attr('aria-label', c.running ? `Đã qua ${e} trên ${n} ngày của kỳ, còn ${c.left_days} ngày đến ngày chốt ${c.end_vi}.` : `Kỳ ${c.label} đã chốt, đủ ${n} ngày.`);
    const paint = (d) => {
      st.ticks.forEach((t, i) => t.style('stroke', i <= d + 1e-6 ? kp.C.d : kp.C.tick));
      st.run.attr('x2', x(d)); st.dot.attr('cx', x(d)); st.core.attr('cx', x(d));
    };
    const from = st.f == null ? 0 : Math.min(st.f, n);
    st.f = e;
    st.svg.interrupt();
    if (kp.still() || from === e) { paint(e); return; }
    const i = d3.interpolateNumber(from, e);
    st.svg.transition().duration(700).ease(d3.easeCubicOut).tween('t', () => (t) => paint(i(t)));
  }
});

// ---------- slim bullet (white card): garnet bar, dashed pace tick on a running cycle, solid target tick
dash.draw('bullet', {
  mount: (el) => ({W: 0, prev: null, tip: null}),
  update: (el, st) => {
    const s = kp.rows('sel'), r = s ? s.find((x) => x.kpi === el.dataset.kpi) : null;
    st.r = r;
    if (!r) { if (!st.svg) el.textContent = '—'; return; }
    const W = Math.max(160, el.clientWidth), H = 24;
    if (W !== st.W || !st.svg) {
      el.replaceChildren();
      st.W = W;
      st.svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
      st.svg.append('rect').attr('x', 2).attr('y', 8).attr('width', W - 5).attr('height', 8).attr('rx', 4).style('fill', kp.C.track);
      st.bar = st.svg.append('rect').attr('x', 2).attr('y', 8).attr('height', 8).attr('rx', 4).style('fill', kp.C.d).style('transition', 'fill .45s');
      st.pw = st.svg.append('line').attr('y1', 3).attr('y2', 21).style('stroke', '#fff').style('stroke-width', 5);
      st.pg = st.svg.append('line').attr('y1', 3).attr('y2', 21).style('stroke', kp.C.ink).style('stroke-width', 2).style('stroke-dasharray', '3 2');
      st.tg = st.svg.append('line').attr('y1', 1).attr('y2', 23).style('stroke', kp.C.ink).style('stroke-width', 2.5);
      st.tip = kp.tip(el);
      st.svg.on('pointermove pointerdown', (ev) => {
        const q = st.r;
        if (!q) return;
        const [px, py] = d3.pointer(ev, el);
        st.tip.show([q.label, `Đạt ${kp.fmt(q.pct, 0)}%`].concat(q.final ? [] : [`Nhịp cần có hôm nay ${kp.fmt(q.pace, 0)}%`]).concat([`Mục tiêu ${kp.fmt(q.target, 0)}%`]), px, py);
      }).on('pointerleave', () => st.tip.hide());
      st.prev = null;
    }
    st.svg.attr('aria-label', `${r.label}: đạt ${kp.fmt(r.pct, 0)}%, mục tiêu ${kp.fmt(r.target, 0)}%`);
    st.bar.style('fill', kp.ink(r));
    const to = {pct: r.pct || 0, pace: r.pace || 0, target: r.target || 100, max: Math.ceil(Math.max(100, r.target || 0, r.pct || 0) / 25) * 25, run: !r.final};
    const paint = (v) => {
      const x = (q) => 2 + (W - 5) * Math.max(0, Math.min(q, v.max)) / v.max;
      st.bar.attr('width', Math.max(0, x(v.pct) - 2));
      [st.pw, st.pg].forEach((l) => l.attr('x1', x(v.pace)).attr('x2', x(v.pace)).attr('visibility', v.run ? 'visible' : 'hidden'));
      st.tg.attr('x1', x(v.target)).attr('x2', x(v.target));
    };
    const from = st.prev || Object.assign({}, to, {pct: 0, pace: 0});
    st.prev = to;
    st.svg.interrupt();
    if (kp.still()) { paint(to); return; }
    const it = d3.interpolateObject(from, to);
    st.svg.transition().duration(700).ease(d3.easeCubicOut).tween('b', () => (t) => paint(it(t)));
  }
});

// ---------- daily cumulative new sales of the selected cycle, with the average of earlier cycles at the same day
dash.draw('curve', {
  mount: () => ({month: null}),
  update: (el, st) => {
    if (!kp.ready(el, 'selday')) return;
    const rows = kp.rows('selday'), month = kp.selMonth();
    el.replaceChildren();
    const done = rows.filter((d) => d.sales != null);
    if (!rows.length || !done.length) { el.textContent = 'Kỳ này không có số liệu theo ngày.'; st.month = month; return; }
    const W = Math.max(260, el.clientWidth), H = W < 480 ? 220 : 250, mb = 24, mt = 14, mr = 40;
    const top = d3.max(rows, (d) => Math.max(d.sales || 0, d.prior_avg || 0));
    const y = d3.scaleLinear([0, Math.max(110, top) * 1.05], [H - mb, mt]).nice();
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const probe = svg.append('g');
    y.ticks(4).forEach((v) => probe.append('text').text(v + '%'));
    const ml = Math.ceil(kp.textW(probe.selectAll('text'))) + 12;
    probe.remove();
    kp.grid(svg, y, ml, W - mr, (v) => v + '%', 4);
    const x = d3.scaleLinear([1, rows.length], [ml, W - mr]);
    const step = Math.max(1, Math.ceil(rows.length / Math.max(3, Math.floor((W - ml - mr) / 70))));
    rows.forEach((d, i) => { if (i % step === 0) svg.append('text').attr('x', x(d.day)).attr('y', H - 6).attr('text-anchor', 'middle').text(d.label); });
    svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(100)).attr('y2', y(100)).style('stroke', kp.C.ink).style('stroke-width', 1).style('opacity', 0.55);
    svg.append('text').attr('x', W - mr + 5).attr('y', y(100)).attr('dy', '0.32em').style('fill', kp.C.ink).text('100%');
    svg.append('path').datum(rows).attr('d', d3.line().x((d) => x(d.day)).y((d) => y(d.pace)))
      .style('fill', 'none').style('stroke', kp.C.pace).style('stroke-width', 1.5).style('stroke-dasharray', '5 4');
    const avg = svg.append('path').datum(rows).attr('d', d3.line().defined((d) => d.prior_avg != null).x((d) => x(d.day)).y((d) => y(d.prior_avg)))
      .style('fill', 'none').style('stroke', kp.C.d3).style('stroke-width', 2.5).style('stroke-dasharray', '0.5 5').style('stroke-linecap', 'round');
    const area = svg.append('path').datum(rows).attr('d', d3.area().defined((d) => d.sales != null).x((d) => x(d.day)).y0(y(0)).y1((d) => y(d.sales))).style('fill', kp.C.tint);
    const line = svg.append('path').datum(rows).attr('d', d3.line().defined((d) => d.sales != null).x((d) => x(d.day)).y((d) => y(d.sales)))
      .style('fill', 'none').style('stroke', kp.C.d).style('stroke-width', 2.5).style('stroke-linejoin', 'round');
    const last = done[done.length - 1];
    const lastDot = svg.append('circle').attr('cx', x(last.day)).attr('cy', y(last.sales)).attr('r', 5).style('fill', kp.C.d).style('stroke', '#fff').style('stroke-width', 2);
    const near = Math.abs(y(last.sales) - y(100)) < 16;
    const lastLab = svg.append('text').attr('class', 'eo-strong').attr('x', Math.min(x(last.day) + 8, W - 30)).attr('y', y(last.sales)).attr('dy', near ? '1.3em' : '-0.6em').text(kp.fmt(last.sales, 0) + '%');
    svg.attr('aria-label', `Doanh thu mới cộng dồn đến ngày ${last.label}: ${kp.fmt(last.sales, 0)}% mục tiêu` + (last.prior_avg != null ? `; các kỳ trước trung bình ${kp.fmt(last.prior_avg, 0)}% ở cùng ngày.` : '.'));
    if (month !== st.month && !kp.still()) {
      try {
        const L = line.node().getTotalLength();
        line.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
          .on('end', () => line.attr('stroke-dasharray', null));
        [area, lastDot, lastLab].forEach((s) => s.style('opacity', 0).transition().delay(350).duration(500).style('opacity', 1));
        avg.style('opacity', 0).transition().duration(600).style('opacity', 1);
      } catch (e) { /* no layout: draw at once */ }
    }
    st.month = month;
    const focus = svg.append('circle').attr('r', 4.5).style('fill', '#fff').style('stroke', kp.C.d).style('stroke-width', 2).attr('visibility', 'hidden');
    const t = kp.tip(el);
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml - mr).attr('height', H - mb).style('fill', 'transparent')
      .on('pointermove pointerdown', (ev) => {
        const [mx] = d3.pointer(ev, svg.node());
        const d = rows[Math.max(0, Math.min(rows.length - 1, Math.round(x.invert(mx)) - 1))];
        if (d.sales != null) focus.attr('cx', x(d.day)).attr('cy', y(d.sales)).attr('visibility', 'visible');
        else focus.attr('visibility', 'hidden');
        const [px, py] = d3.pointer(ev, el);
        t.show([`Ngày ${d.day} · ${d.label}`, d.sales != null ? `Kỳ đang xem ${kp.fmt(d.sales, 1)}%` : 'Chưa tới ngày này']
          .concat(d.prior_avg != null ? [`TB ${d.prior_n} kỳ trước ${kp.fmt(d.prior_avg, 1)}%`] : []).concat([`Nhịp đều ${kp.fmt(d.pace, 1)}%`]), px, py);
      })
      .on('pointerleave', () => { t.hide(); focus.attr('visibility', 'hidden'); });
  }
});

// ---------- results per cycle with the average up to each cycle; the selected cycle is banded; a tap selects a cycle
dash.draw('history', (el) => {
  if (!kp.ready(el, 'months')) return;
  const rows = kp.rows('months'), on = kp.selMonth();
  el.replaceChildren();
  if (!rows.length) { el.textContent = 'Chưa có kỳ nào.'; return; }
  const kr = kp.rows('kpi') || [];
  const tgt = (k, d) => { const r = kr.find((x) => x.kpi === k); return r ? r.target : d; };
  const series = [
    {k: 'reenroll', name: 'Tái tục', t: tgt('reenroll', 95)},
    {k: 'newsales', name: 'Doanh thu mới', t: tgt('newsales', 100)},
    {k: 'newstudents', name: 'Học viên mới', t: tgt('newstudents', 100)}
  ];
  const W = Math.max(260, el.clientWidth), narrow = W < 560, lw = narrow ? 8 : 118, vw = 46, rh = narrow ? 86 : 84, top = narrow ? 22 : 10, bot = 10;
  const H = series.length * rh + 22;
  const vmax = d3.max(rows, (r) => d3.max(series, (s) => Math.max(r[s.k] == null ? 0 : r[s.k], r['ytd_' + s.k] == null ? 0 : r['ytd_' + s.k])));
  const x = d3.scalePoint(rows.map((r) => r.month), [lw + 6, W - vw]).padding(0.3);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
  if (on) svg.append('rect').attr('class', 'eo-band').attr('x', x(on) - x.step() / 2).attr('y', 0).attr('width', x.step()).attr('height', series.length * rh).attr('rx', 8).style('fill', kp.C.band);
  series.forEach((s, i) => {
    const g = svg.append('g').attr('transform', `translate(0,${i * rh})`);
    const y = d3.scaleLinear([0, Math.max(110, vmax) * 1.04], [rh - bot, top]);
    if (i) g.append('line').attr('x1', 0).attr('x2', W).attr('y1', 0).attr('y2', 0).style('stroke', kp.C.hair);
    g.append('text').attr('class', 'eo-lab').attr('x', 0).attr('y', narrow ? 15 : (rh - bot + top) / 2).attr('dy', narrow ? 0 : '0.32em').text(s.name);
    g.append('line').attr('x1', lw + 6).attr('x2', W - vw).attr('y1', y(s.t)).attr('y2', y(s.t)).style('stroke', kp.C.ink).style('stroke-width', 1).style('stroke-dasharray', '2 3').style('opacity', 0.6);
    g.append('text').attr('x', W - vw + 6).attr('y', y(s.t)).attr('dy', '0.32em').style('fill', kp.C.ink).text(s.t + '%');
    g.append('path').datum(rows).attr('d', d3.line().defined((r) => r['ytd_' + s.k] != null).x((r) => x(r.month)).y((r) => y(r['ytd_' + s.k])))
      .style('fill', 'none').style('stroke', kp.C.d3).style('stroke-width', 2.5).style('stroke-dasharray', '0.5 5').style('stroke-linecap', 'round');
    g.append('path').datum(rows).attr('d', d3.line().defined((r) => r[s.k] != null).x((r) => x(r.month)).y((r) => y(r[s.k])))
      .style('fill', 'none').style('stroke', kp.C.d).style('stroke-width', 2).style('stroke-linejoin', 'round');
    g.selectAll('circle').data(rows.filter((r) => r[s.k] != null)).join('circle')
      .attr('cx', (r) => x(r.month)).attr('cy', (r) => y(r[s.k])).attr('r', (r) => (r.month === on ? 5.5 : r.running ? 4.5 : 3))
      .style('fill', (r) => (r.running ? '#fff' : kp.C.d)).style('stroke', kp.C.d).style('stroke-width', 2);
    const sr = rows.find((r) => r.month === on);
    if (sr && sr[s.k] != null) {
      const ly = y(sr[s.k]), clash = Math.abs(ly - y(s.t)) < 12;
      g.append('text').attr('class', 'eo-strong').attr('x', Math.max(lw + 20, Math.min(x(sr.month), W - vw - 10))).attr('y', ly).attr('dy', clash || ly < top + 14 ? '1.35em' : '-0.75em').attr('text-anchor', 'middle').text(sr[s.k] + '%');
    }
  });
  kp.xLabels(svg, rows.map((r) => ({k: r.month, label: r.short})), x, H - 4, on);
  const sr = rows.find((r) => r.month === on) || rows[rows.length - 1];
  svg.attr('aria-label', `Kết quả từng kỳ từ ${rows[0].label} đến ${rows[rows.length - 1].label}. Kỳ ${sr.label}: tái tục ${sr.reenroll}%, doanh thu mới ${sr.newsales}%, học viên mới ${sr.newstudents}%.`);
  const guide = svg.append('line').attr('y1', 0).attr('y2', series.length * rh).style('stroke', kp.C.hair).style('stroke-width', 1.5).attr('visibility', 'hidden');
  const t = kp.tip(el);
  const at = (ev) => { const [mx] = d3.pointer(ev, svg.node()); return rows[Math.max(0, Math.min(rows.length - 1, Math.round((mx - x(rows[0].month)) / (x.step() || 1))))]; };
  svg.append('rect').attr('x', lw).attr('y', 0).attr('width', W - lw - vw + 6).attr('height', series.length * rh).style('fill', 'transparent').style('cursor', 'pointer')
    .on('pointermove pointerdown', (ev) => {
      const r = at(ev);
      guide.attr('x1', x(r.month)).attr('x2', x(r.month)).attr('visibility', 'visible');
      const [px, py] = d3.pointer(ev, el);
      t.show([`${r.label} · ${r.state.toLowerCase()}`].concat(series.map((s) => `${s.name}: ${r[s.k] == null ? '—' : r[s.k] + '%'}` + (r['ytd_' + s.k] == null ? '' : ` · TB ${r['ytd_' + s.k]}%`))), px, py);
    })
    .on('pointerleave', () => { t.hide(); guide.attr('visibility', 'hidden'); })
    .on('click', (ev) => kp.pick(at(ev).month));
});

// ---------- average per new student by cycle: lollipops, the selected cycle in full colour; a tap selects a cycle
dash.draw('avg', (el) => {
  if (!kp.ready(el, 'months')) return;
  const rows = kp.rows('months').filter((r) => r.avg_m != null), on = kp.selMonth();
  el.replaceChildren();
  if (!rows.length) { el.textContent = 'Chưa có kỳ nào.'; return; }
  const W = Math.max(240, el.clientWidth), H = 170, mb = 22, mt = 22;
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r.avg_m) * 1.12], [H - mb, mt]);
  const x = d3.scalePoint(rows.map((r) => r.month), [10, W - 10]).padding(0.5);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
  if (on && rows.some((r) => r.month === on)) svg.append('rect').attr('class', 'eo-band').attr('x', x(on) - x.step() / 2).attr('y', 4).attr('width', x.step()).attr('height', H - mb - 2).attr('rx', 8).style('fill', kp.C.band);
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', kp.C.hair);
  const t = kp.tip(el);
  rows.forEach((r) => {
    const cx = x(r.month), cy = y(r.avg_m), sel = r.month === on;
    svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y(0)).attr('y2', cy).style('stroke', kp.C.d).style('stroke-width', sel ? 3 : 2).style('stroke-opacity', sel ? 1 : 0.4);
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', sel ? 6 : 4).style('fill', r.running ? '#fff' : kp.C.d).style('fill-opacity', r.running || sel ? 1 : 0.5).style('stroke', kp.C.d).style('stroke-width', 2).style('stroke-opacity', sel ? 1 : 0.5);
    if (sel || x.step() >= 34) svg.append('text').attr('class', sel ? 'eo-strong' : null).attr('x', cx).attr('y', cy - 11).attr('text-anchor', 'middle').text(kp.fmt(r.avg_m, 2));
    svg.append('rect').attr('x', cx - x.step() / 2).attr('y', 0).attr('width', x.step()).attr('height', H - mb).style('fill', 'transparent').style('cursor', 'pointer')
      .on('pointermove pointerdown', (ev) => { const [px, py] = d3.pointer(ev, el); t.show([`${r.label} · ${r.state.toLowerCase()}`, `Bình quân ${kp.fmt(r.avg_m, 2)} triệu ₫`], px, py); })
      .on('pointerleave', () => t.hide())
      .on('click', () => kp.pick(r.month));
  });
  kp.xLabels(svg, rows.map((r) => ({k: r.month, label: r.short})), x, H - 4, on);
  const sr = rows.find((r) => r.month === on) || rows[rows.length - 1];
  svg.attr('aria-label', `Bình quân mỗi học viên mới theo kỳ, từ ${rows[0].label} đến ${rows[rows.length - 1].label}; kỳ ${sr.label}: ${kp.fmt(sr.avg_m, 2)} triệu đồng.`);
});
