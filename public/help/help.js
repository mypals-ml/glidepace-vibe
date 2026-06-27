/* Glidelines Help Center — renderer & i18n wiring.
   Each help page is a thin shell that sets <body data-topic="..."> (or "home").
   This script picks the language, renders the chrome (sidebar, language switch),
   and renders the page body from window.HELP.DATA. */
(function () {
  const { TOPIC_ORDER, TOPIC_ICONS, LANGS, LANG_LABELS, DATA } = window.HELP;
  const HELP_LANG_KEY = 'glidelines_help_lang';
  const APP_LANG_KEY = 'ui_locale'; // shared with the app
  const ASSET_BASE = 'assets/';

  // ---- language resolution: ?lang > help choice > app locale > browser > en ----
  function detectBrowser() {
    const langs = [navigator.language, ...(navigator.languages || [])].map((l) => l.toLowerCase());
    for (const l of langs) {
      if (l.startsWith('zh-tw') || l.startsWith('zh-hk') || l.includes('hant')) return 'zh-TW';
      if (l.startsWith('zh')) return 'zh-CN';
      if (l.startsWith('ja')) return 'ja';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ignore */ } }
  function isValid(l) { return LANGS.includes(l); }

  function resolveLang() {
    const param = new URLSearchParams(location.search).get('lang');
    if (param && isValid(param)) return param;
    const help = read(HELP_LANG_KEY);
    if (help && isValid(help)) return help;
    const app = read(APP_LANG_KEY);
    if (app && isValid(app)) return app;
    return detectBrowser();
  }

  let lang = resolveLang();

  // ---- tiny markdown: **bold** only, with HTML escaping ----
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmt(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  };

  function topicHref(id) { return id === 'home' ? 'index.html' : id + '.html'; }

  function withLang(href) {
    return href + '?lang=' + encodeURIComponent(lang);
  }

  // ---- chrome: sidebar + topbar ----
  function renderChrome(activeTopic) {
    const ui = DATA[lang].ui;
    document.documentElement.lang = lang;
    document.title = (activeTopic === 'home'
      ? ui.heroTitle
      : DATA[lang].topics[activeTopic].title) + ' · Glidelines ' + ui.brandSub;

    const shell = el('div', { class: 'shell' });

    // Sidebar
    const sidebar = el('aside', { class: 'sidebar' });
    const brand = el('a', { class: 'brand', href: withLang('index.html') });
    brand.appendChild(el('span', { class: 'brand-mark' }, 'G'));
    const bt = el('span', { class: 'brand-text' });
    bt.appendChild(el('span', { class: 'brand-name' }, 'Glidelines'));
    bt.appendChild(el('span', { class: 'brand-sub' }, ui.brandSub));
    brand.appendChild(bt);
    sidebar.appendChild(brand);

    sidebar.appendChild(el('div', { class: 'nav-group-label' }, ui.guide));
    const nav = el('nav', { class: 'nav' });
    const overview = el('a', { href: withLang('index.html'), class: activeTopic === 'home' ? 'active' : '' });
    overview.innerHTML = '<span class="nav-ico">🏠</span>' + esc(ui.homeNav);
    nav.appendChild(overview);
    TOPIC_ORDER.forEach((id) => {
      const a = el('a', { href: withLang(topicHref(id)), class: id === activeTopic ? 'active' : '' });
      a.innerHTML = '<span class="nav-ico">' + TOPIC_ICONS[id] + '</span>' + esc(DATA[lang].topics[id].title);
      nav.appendChild(a);
    });
    sidebar.appendChild(nav);
    shell.appendChild(sidebar);

    const scrim = el('div', { class: 'scrim' });
    scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));
    shell.appendChild(scrim);

    // Main
    const main = el('div', { class: 'main' });
    const topbar = el('div', { class: 'topbar' });
    const left = el('div', { class: 'topbar-left' });
    const toggle = el('button', { class: 'menu-toggle', 'aria-label': 'Menu' }, '☰');
    toggle.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    left.appendChild(toggle);
    const crumb = el('span', { class: 'crumb' });
    crumb.innerHTML = '<a href="' + withLang('index.html') + '">' + esc(ui.backHome) + '</a>'
      + (activeTopic === 'home' ? '' : ' / ' + esc(DATA[lang].topics[activeTopic].title));
    left.appendChild(crumb);
    topbar.appendChild(left);

    // language switch
    const ls = el('div', { class: 'lang-switch', role: 'group', 'aria-label': 'Language' });
    LANGS.forEach((l) => {
      const b = el('button', { class: l === lang ? 'active' : '', type: 'button' }, LANG_LABELS[l]);
      b.addEventListener('click', () => {
        lang = l; write(HELP_LANG_KEY, l);
        const url = new URL(location.href);
        url.searchParams.set('lang', l);
        history.replaceState(null, '', url);
        rerender(activeTopic);
      });
      ls.appendChild(b);
    });
    topbar.appendChild(ls);
    main.appendChild(topbar);

    const content = el('main', { class: 'content', id: 'help-content' });
    main.appendChild(content);

    const foot = el('footer', { class: 'foot' });
    foot.innerHTML = esc(ui.footer) + ' <a href="https://github.com/mypals-ml/glidepace-vibe" target="_blank" rel="noopener noreferrer">' + esc(ui.sourceLink) + '</a>';
    main.appendChild(foot);

    shell.appendChild(main);
    return { shell, content };
  }

  // ---- figure with graceful missing-image handling ----
  function figure(img) {
    if (!img) return null;
    const fig = el('figure', { class: 'shot is-missing' });
    const image = el('img', { src: ASSET_BASE + img.key + '.png', alt: img.cap || '', loading: 'lazy' });
    image.addEventListener('load', () => fig.classList.remove('is-missing'));
    image.addEventListener('error', () => fig.classList.add('is-missing'));
    fig.appendChild(image);
    if (img.cap) fig.appendChild(el('figcaption', null, esc(img.cap)));
    return fig;
  }

  // ---- home page ----
  function renderHome(content) {
    const ui = DATA[lang].ui;
    const hero = el('section', { class: 'hero' });
    hero.appendChild(el('span', { class: 'pill' }, esc(ui.heroPill)));
    hero.appendChild(el('h1', null, esc(ui.heroTitle)));
    hero.appendChild(el('p', null, esc(ui.heroDesc)));
    content.appendChild(hero);

    content.appendChild(el('div', { class: 'nav-group-label', style: 'padding-left:0;margin-top:18px' }, esc(ui.browseTopics)));
    const grid = el('div', { class: 'card-grid' });
    TOPIC_ORDER.forEach((id) => {
      const t = DATA[lang].topics[id];
      const card = el('a', { class: 'topic-card', href: withLang(topicHref(id)) });
      card.appendChild(el('div', { class: 't-ico' }, TOPIC_ICONS[id]));
      card.appendChild(el('h3', null, esc(t.title)));
      card.appendChild(el('p', null, esc(t.short)));
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ---- topic page ----
  function renderTopic(content, id) {
    const ui = DATA[lang].ui;
    const t = DATA[lang].topics[id];

    const head = el('div', { class: 'topic-head' });
    head.appendChild(el('div', { class: 't-ico' }, TOPIC_ICONS[id]));
    head.appendChild(el('h1', null, esc(t.title)));
    content.appendChild(head);
    content.appendChild(el('p', { class: 'tagline' }, esc(t.tagline)));

    // On-this-page TOC
    if (t.sections.length > 1) {
      content.appendChild(el('div', { class: 'nav-group-label', style: 'padding-left:0' }, esc(ui.onThisPage)));
      const toc = el('ul', { style: 'list-style:none;padding:0;margin:0 0 6px;display:flex;flex-wrap:wrap;gap:8px' });
      t.sections.forEach((s) => {
        const li = el('li', null, '');
        li.innerHTML = '<a href="#' + s.id + '" style="font-size:13px;background:rgba(79,70,229,0.07);padding:5px 12px;border-radius:999px;display:inline-block">' + esc(s.h) + '</a>';
        toc.appendChild(li);
      });
      content.appendChild(toc);
    }

    t.sections.forEach((s) => {
      const sec = el('section', { class: 'block', id: s.id });
      sec.appendChild(el('h2', null, esc(s.h)));
      (s.p || []).forEach((p) => sec.appendChild(el('p', null, fmt(p))));
      if (s.chips) {
        const row = el('div', { class: 'chip-row' });
        row.innerHTML =
          '<span class="chip todo">Todo</span>' +
          '<span class="chip progress">In Progress</span>' +
          '<span class="chip done">Done</span>';
        sec.appendChild(row);
      }
      if (s.bullets) {
        const ul = el('ul');
        s.bullets.forEach((b) => ul.appendChild(el('li', null, fmt(b))));
        sec.appendChild(ul);
      }
      const fig = figure(s.img);
      if (fig) sec.appendChild(fig);
      if (s.tip) {
        const c = el('div', { class: 'callout' });
        c.innerHTML = '<span class="c-ico">💡</span><span><strong>' + esc(ui.tipLabel) + ':</strong> ' + fmt(s.tip) + '</span>';
        sec.appendChild(c);
      }
      content.appendChild(sec);
    });

    // Pager
    const idx = TOPIC_ORDER.indexOf(id);
    const prevId = idx > 0 ? TOPIC_ORDER[idx - 1] : 'home';
    const nextId = idx < TOPIC_ORDER.length - 1 ? TOPIC_ORDER[idx + 1] : null;
    const pager = el('nav', { class: 'pager' });
    const prev = el('a', { class: 'prev', href: withLang(topicHref(prevId)) });
    prev.innerHTML = '<div class="p-dir">‹ ' + esc(ui.prev) + '</div><div class="p-title">' +
      esc(prevId === 'home' ? ui.homeNav : DATA[lang].topics[prevId].title) + '</div>';
    pager.appendChild(prev);
    const next = el('a', { class: nextId ? 'next' : 'next disabled', href: nextId ? withLang(topicHref(nextId)) : '#' });
    if (nextId) {
      next.innerHTML = '<div class="p-dir">' + esc(ui.next) + ' ›</div><div class="p-title">' +
        esc(DATA[lang].topics[nextId].title) + '</div>';
    }
    pager.appendChild(next);
    content.appendChild(pager);
  }

  // ---- mount / rerender ----
  function rerender(activeTopic) {
    document.body.innerHTML = '';
    const { shell, content } = renderChrome(activeTopic);
    document.body.appendChild(shell);
    if (activeTopic === 'home') renderHome(content);
    else renderTopic(content, activeTopic);
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  function boot() {
    const activeTopic = document.body.getAttribute('data-topic') || 'home';
    rerender(activeTopic);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
