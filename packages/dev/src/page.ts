import { style } from "./style.ts";

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const icon = (path: string): string =>
  '<svg viewBox="0 0 16 16" aria-hidden="true">' + path + "</svg>";

/** The page shell. The client script draws everything in it from `/api/state`. */
export const page = (title: string): string => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · svjeez dev</title>
<style>${style}</style>
<header id="bar">
  <div class="brand"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="1" y="1" width="18" height="18" rx="5" fill="var(--text)"/><path d="M5.5 13.5c2-6 4-6 4.5-3.5s2.5 2.5 4.5-3.5" fill="none" stroke="var(--surface)" stroke-width="1.8" stroke-linecap="round"/></svg>svjeez</div>
  <span class="crumb-sep">/</span>
  <span id="title"></span>
  <span id="status" class="status"><i class="dot"></i><span id="status-text"></span></span>
  <span class="spacer"></span>
  <button id="undo" class="icon-btn" type="button" title="Undo (⌘Z)" aria-label="Undo">${icon('<path d="M6 4L3 7l3 3"/><path d="M3 7h6.5a3.5 3.5 0 010 7H8"/>')}</button>
  <button id="redo" class="icon-btn" type="button" title="Redo (⇧⌘Z)" aria-label="Redo">${icon('<path d="M10 4l3 3-3 3"/><path d="M13 7H6.5a3.5 3.5 0 000 7H8"/>')}</button>
</header>
<div id="layout">
  <nav id="picker" aria-label="Scenes">
    <div class="find">${icon('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>')}<input id="filter" type="search" placeholder="Find a scene" aria-label="Find a scene" autocomplete="off" spellcheck="false"><span class="kbd">⌘K</span></div>
    <div id="scenes" role="listbox" aria-label="Scenes"></div>
  </nav>
  <section id="code-pane" aria-label="Source">
    <div class="chrome"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span><span id="filename"></span><span id="code-note"></span><span class="spacer"></span><button id="reset" class="pill" type="button" title="Undo every edit made since the scene opened">Reset</button></div>
    <div id="source" class="code"></div>
  </section>
  <main id="right">
    <div id="error" class="banner" role="alert" hidden>${icon('<path d="M8 1.8L14.6 13.5H1.4z"/><path d="M8 6.2v3.3"/><path d="M8 11.6v.1"/>')}<div><b>The scene did not build</b><div class="why">The stage keeps the last picture that did. Fix the file and it rebuilds.</div><pre id="error-text"></pre></div></div>
    <div id="stage" class="card"><div id="art"></div><span id="badge"></span></div>
    <div id="transport">
      <button id="toggle" class="pill" type="button"></button>
      <span><span id="clock">0.00s</span> <span id="clock-total"></span></span>
      <span class="spacer"></span>
      <span id="loop-note"></span>
    </div>
    <section class="card panel" aria-label="Timeline">
      <div class="panel-head"><h2>Timeline</h2><span class="note" id="timeline-note"></span></div>
      <div id="timeline"></div>
    </section>
    <div id="stats"><span id="stats-text"></span><a id="download" href="/api/svg" download>${icon('<path d="M8 2.5v8"/><path d="M4.5 7.5L8 11l3.5-3.5"/><path d="M3 13.5h10"/>')}Download SVG</a></div>
    <ul id="warnings" aria-label="Compiler warnings"></ul>
    <section id="inspector" class="card panel" hidden>
      <div class="panel-head"><div class="inspect-title" id="inspect-title"></div><span class="spacer"></span><div class="segmented" id="across" role="group" aria-label="Variants"><button type="button" data-across="false" aria-pressed="true">At playhead</button><button type="button" data-across="true" aria-pressed="false">Across time</button></div><button id="inspect-close" class="icon-btn close" type="button" aria-label="Close">${icon('<path d="M4 4l8 8M12 4l-8 8"/>')}</button></div>
      <div id="inspect-control"></div>
      <div class="panel-head variants-head"><span class="note" id="variants-title"></span></div>
      <div id="variants" class="strip"></div>
    </section>
    <section class="card panel" aria-label="Frames">
      <div class="panel-head"><h2>Frames</h2><span class="note">the whole scene at once · click one to go there</span></div>
      <div id="filmstrip" class="strip"></div>
    </section>
    <section id="composed-box" class="card panel" hidden>
      <div class="panel-head"><h2>Composed</h2><span class="note">from the scene's controls export</span></div>
      <div id="controls"></div>
    </section>
    <section id="log" class="card panel"></section>
  </main>
</div>
<script type="module" src="/client.js"></script>
</html>
`;
