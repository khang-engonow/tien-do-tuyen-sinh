// dash-lite.js — runtime nho cho trang tien do KPI khi dang ngoai Claude (GitHub Pages).
// Cung API voi trang Data cua Claude ma app.js dung: loader, calc, draw, onData, data, params, setParams.
// Du lieu: data/kpi.json (months, kpi) va data/daily.json (duong doanh thu moi theo ngay).
(function () {
  const L = {}, C = {}, D = {}, O = [], rows = {}, state = new Map();
  let status = 'loading', params = {}, queued = false;

  function readHash() {
    const m = /(?:^|[#&])ky=(\d{4}-\d{2})/.exec(location.hash);
    return m ? {month: m[1]} : {};
  }
  function writeHash() {
    try { history.replaceState(null, '', params.month ? '#ky=' + params.month : location.pathname + location.search); } catch (e) { /* file:// */ }
  }

  window.dash = {
    loader(id, o) { L[id] = o.fn; },
    calc(id, o) { C[id] = o; },
    draw(name, f) { D[name] = f; },
    onData(f) { O.push(f); },
    params() { return Object.assign({}, params); },
    setParams(p) { params = Object.assign({}, params, p); writeHash(); schedule(); },
    data(id) {
      if (status !== 'ok') return {status, data: null};
      if (id in rows) return {status: 'ok', data: rows[id]};
      const c = C[id];
      if (!c) return {status: 'error', data: null};
      const ins = c.inputs.map((i) => dash.data(i));
      if (!ins.every((x) => x.status === 'ok')) return {status: ins.some((x) => x.status === 'error') ? 'error' : 'loading', data: null};
      try { return {status: 'ok', data: c.fn(...ins.map((x) => x.data))}; } catch (e) { console.error(e); return {status: 'error', data: null}; }
    }
  };

  function run() {
    queued = false;
    O.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    document.querySelectorAll('[data-draw]').forEach((el) => {
      const d = D[el.dataset.draw];
      if (!d) return;
      try {
        if (typeof d === 'function') d(el);
        else {
          let st = state.get(el);
          if (!st) { el.replaceChildren(); st = d.mount(el); state.set(el, st); }
          d.update(el, st);
        }
      } catch (e) { console.error(e); }
    });
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(run); } }

  async function load() {
    try {
      const get = (u) => fetch(u, {cache: 'no-cache'}).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
      const [file, daily] = await Promise.all([get('data/kpi.json'), get('data/daily.json')]);
      for (const id in L) rows[id] = L[id]({answer: file});
      rows.daily = Array.isArray(daily) ? daily : [];
      status = 'ok';
    } catch (e) {
      console.error(e);
      status = 'error';
    }
    run();
  }

  params = readHash();
  window.addEventListener('hashchange', () => { const h = readHash(); if (h.month !== params.month) { params = Object.assign({}, params, h); schedule(); } });
  let w = window.innerWidth, t = null;
  window.addEventListener('resize', () => {
    if (window.innerWidth === w) return;
    w = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(run, 150);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
