/** The page's look: one set of tokens for light and dark, a sans for the chrome, a mono for code and numbers. */
export const style = String.raw`
:root {
  color-scheme: light dark;
  --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  --bg: #f7f7f8;
  --surface: #ffffff;
  --sunken: #f2f2f4;
  --raised: #ffffff;
  --hover: rgb(0 0 0 / 0.04);
  --press: rgb(0 0 0 / 0.07);
  --line: rgb(0 0 0 / 0.08);
  --line-strong: rgb(0 0 0 / 0.13);
  --text: #18181b;
  --text-2: #55555e;
  --text-3: #8e8e97;
  --text-4: #b4b4bc;
  --accent: #4f5bd5;
  --accent-text: #ffffff;
  --accent-soft: rgb(79 91 213 / 0.12);
  --accent-line: rgb(79 91 213 / 0.45);
  --scrub: #d9730d;
  --scrub-soft: rgb(217 115 13 / 0.12);
  --row-hot: rgb(34 160 84 / 0.1);
  --row-mark: #22a054;
  --playhead: #e5484d;
  --danger: #d93d42;
  --danger-soft: rgb(229 72 77 / 0.08);
  --ok: #22a054;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-pop: 0 0 0 1px rgb(0 0 0 / 0.06), 0 8px 24px -4px rgb(0 0 0 / 0.14), 0 2px 6px rgb(0 0 0 / 0.06);
  --focus: 0 0 0 2px var(--surface), 0 0 0 4px rgb(79 91 213 / 0.5);
  --syn-k: #8a3fd1;
  --syn-f: #2f63d6;
  --syn-t: #0b7f9c;
  --syn-s: #2f7d32;
  --syn-n: #c4560c;
  --syn-c: #9a9aa3;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --fast: 120ms;
  --slow: 180ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f11;
    --surface: #161618;
    --sunken: #1c1c1f;
    --raised: #1f1f23;
    --hover: rgb(255 255 255 / 0.045);
    --press: rgb(255 255 255 / 0.08);
    --line: rgb(255 255 255 / 0.075);
    --line-strong: rgb(255 255 255 / 0.13);
    --text: #ececef;
    --text-2: #a6a6af;
    --text-3: #707079;
    --text-4: #4d4d55;
    --accent: #7c86ff;
    --accent-text: #0f0f11;
    --accent-soft: rgb(124 134 255 / 0.16);
    --accent-line: rgb(124 134 255 / 0.55);
    --scrub: #f29a4a;
    --scrub-soft: rgb(242 154 74 / 0.14);
    --row-hot: rgb(74 222 128 / 0.075);
    --row-mark: #4ade80;
    --playhead: #ff5f63;
    --danger: #ff6b6f;
    --danger-soft: rgb(255 95 99 / 0.09);
    --ok: #4ade80;
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
    --shadow-pop: 0 0 0 1px rgb(255 255 255 / 0.08), 0 12px 32px -6px rgb(0 0 0 / 0.6), 0 2px 8px rgb(0 0 0 / 0.3);
    --focus: 0 0 0 2px var(--surface), 0 0 0 4px rgb(124 134 255 / 0.6);
    --syn-k: #c49bff;
    --syn-f: #82aaff;
    --syn-t: #6fd3e8;
    --syn-s: #a3d98b;
    --syn-n: #f8a066;
    --syn-c: #6b6b75;
  }
}

* { box-sizing: border-box }
html, body { height: 100% }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 13px/1.45 var(--sans); letter-spacing: -0.003em;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  display: grid; grid-template-rows: 44px minmax(0, 1fr); overflow: hidden;
}
button, input, select { font: inherit; color: inherit; letter-spacing: inherit }
button { cursor: pointer; background: none; border: 0; padding: 0; border-radius: 6px }
button:disabled { cursor: default; opacity: 0.4 }
:focus { outline: none }
:focus-visible { box-shadow: var(--focus); border-radius: 6px }
[hidden] { display: none !important }
.mono, .num { font-family: var(--mono); font-variant-numeric: tabular-nums }
.num { font-feature-settings: "tnum" 1 }

/* bar */
#bar { display: flex; align-items: center; gap: 8px; padding: 0 12px 0 14px; border-bottom: 1px solid var(--line); background: var(--surface); min-width: 0 }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: -0.01em; color: var(--text) }
.brand svg { width: 18px; height: 18px; display: block }
.crumb-sep { color: var(--text-4); font-weight: 300; font-size: 16px; margin: 0 2px }
#title { font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
#title .dir { color: var(--text-3); font-weight: 400 }
.status { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; color: var(--text-3); font-size: 12px; white-space: nowrap; margin-left: 4px }
.status .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); flex: none; transition: background var(--fast) }
.status.busy .dot { background: var(--accent); animation: pulse 1s var(--ease) infinite }
.status.failed { color: var(--danger) }
.status.failed .dot { background: var(--danger) }
@keyframes pulse { 50% { opacity: 0.35 } }
.spacer { flex: 1 }
.icon-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; color: var(--text-2); transition: background var(--fast), color var(--fast) }
.icon-btn:hover:not(:disabled) { background: var(--hover); color: var(--text) }
.icon-btn:active:not(:disabled) { background: var(--press) }
.icon-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round }
.kbd { font: 11px var(--sans); color: var(--text-3); border: 1px solid var(--line-strong); border-bottom-width: 1.5px; border-radius: 4px; padding: 0 4px; line-height: 16px }

/* layout */
#layout { display: grid; grid-template-columns: 216px minmax(420px, 1fr) minmax(480px, 1.08fr); min-height: 0 }
#layout.single { grid-template-columns: minmax(420px, 1fr) minmax(480px, 1.08fr) }
#layout.single #picker { display: none }

/* scene list */
#picker { border-right: 1px solid var(--line); background: var(--surface); display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0 }
.find { padding: 10px 10px 6px; position: relative }
.find input { width: 100%; height: 30px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--sunken); padding: 0 34px 0 28px; font-size: 12.5px; transition: border-color var(--fast), box-shadow var(--fast), background var(--fast) }
.find input::placeholder { color: var(--text-3) }
.find input:focus { border-color: var(--accent-line); background: var(--surface); box-shadow: 0 0 0 3px var(--accent-soft) }
.find svg { position: absolute; left: 19px; top: 18px; width: 14px; height: 14px; fill: none; stroke: var(--text-3); stroke-width: 1.6; stroke-linecap: round }
.find .kbd { position: absolute; right: 18px; top: 17px }
#scenes { overflow: auto; padding: 2px 6px 12px; scrollbar-width: thin }
.scene { display: flex; align-items: baseline; gap: 8px; width: 100%; height: 28px; padding: 0 8px; border-radius: 6px; text-align: start; color: var(--text-2); transition: background var(--fast), color var(--fast) }
.scene:hover { background: var(--hover); color: var(--text) }
.scene .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 28px }
.scene .where { color: var(--text-4); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45% }
.scene[aria-current="true"] { background: var(--accent-soft); color: var(--text); font-weight: 500 }
.scene[aria-current="true"] .where { color: var(--text-3) }
.scene.cursor:not([aria-current="true"]) { background: var(--hover); color: var(--text) }
.scenes-empty { color: var(--text-3); padding: 8px 10px; font-size: 12px }

/* code window */
#code-pane { display: grid; grid-template-rows: 40px minmax(0, 1fr); min-height: 0; min-width: 0; margin: 12px 0 12px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); overflow: hidden }
#layout.single #code-pane { margin-left: 12px }
.chrome { display: flex; align-items: center; gap: 10px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--line); min-width: 0 }
.lights { display: inline-flex; gap: 6px; flex: none }
.lights i { width: 10px; height: 10px; border-radius: 50%; background: var(--line-strong) }
#filename .dir { color: var(--text-3); font-weight: 400 }
#filename { font: 500 12.5px var(--mono); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 4px }
#code-note { color: var(--text-3); font-size: 12px; white-space: nowrap }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); font-size: 12px; font-weight: 500; box-shadow: var(--shadow-sm); transition: background var(--fast), border-color var(--fast), transform var(--fast) }
.pill:hover:not(:disabled) { background: var(--sunken) }
.pill:active:not(:disabled) { transform: translateY(0.5px); background: var(--press) }
.pill svg { width: 12px; height: 12px; fill: currentColor }

.code { overflow: auto; font: 12.5px/20px var(--mono); font-variant-ligatures: none; tab-size: 2; padding: 10px 0 40px; scrollbar-width: thin; position: relative }
.code .lines { min-width: 100%; width: max-content }
.ln { display: grid; grid-template-columns: calc(var(--digits, 3) * 1ch + 32px) auto; white-space: pre; position: relative; transition: background var(--slow) var(--ease) }
.ln .no { position: sticky; left: 0; z-index: 1; text-align: right; padding-right: 18px; color: var(--text-4); background: var(--surface); user-select: none; transition: color var(--fast), background var(--slow) var(--ease) }
.ln .tx { padding-right: 24px }
.ln.hot, .ln.lit-line { background: var(--row-hot) }
.ln.hot .no, .ln.lit-line .no { color: var(--text-2); background: color-mix(in srgb, var(--row-mark) 7%, var(--surface)) }
.ln.hot .no::before, .ln.lit-line .no::before { content: ""; position: absolute; left: 0; top: 2px; bottom: 2px; width: 2px; border-radius: 0 2px 2px 0; background: var(--row-mark) }
.code .k { color: var(--syn-k) }
.code .f { color: var(--syn-f) }
.code .t { color: var(--syn-t) }
.code .s { color: var(--syn-s) }
.code .n { color: var(--syn-n) }
.code .c { color: var(--syn-c) }

.lit { border-radius: 3px; transition: background var(--fast), box-shadow var(--fast) }
.lit[data-kind="number"], .lit[data-kind="span"] { cursor: ew-resize; text-decoration: underline dotted var(--scrub); text-decoration-thickness: 1.5px; text-underline-offset: 4px; user-select: none; touch-action: none }
.lit[data-kind="number"]:hover, .lit[data-kind="span"]:hover, .lit.dragging { background: var(--scrub-soft); box-shadow: 0 0 0 2px var(--scrub-soft) }
.lit.dragging { text-decoration-style: solid }
.lit[data-kind="color"], .lit[data-kind="ease"], .lit[data-kind="boolean"] { cursor: pointer }
.lit[data-kind="boolean"] { text-decoration: underline dotted var(--text-3); text-underline-offset: 4px }
.lit[data-kind="color"]:hover, .lit[data-kind="ease"]:hover, .lit[data-kind="boolean"]:hover, .lit[data-kind="text"]:hover { background: var(--hover); box-shadow: 0 0 0 2px var(--hover) }
.lit.hot { background: var(--scrub-soft); box-shadow: 0 0 0 2px var(--scrub-soft) }
.code.scrubbing, .code.scrubbing * { cursor: ew-resize !important }
.swatch { display: inline-block; width: 12px; height: 12px; margin: 0 5px 0 1px; vertical-align: -1.5px; border-radius: 3.5px; background: var(--c); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.14); transition: transform var(--fast) var(--ease), box-shadow var(--fast) }
.swatch:hover { transform: scale(1.18); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2), 0 0 0 2px var(--surface), 0 0 0 3px var(--line-strong) }
.curve { display: inline-grid; place-items: center; width: 16px; height: 16px; margin: 0 4px 0 0; vertical-align: -3px; border-radius: 4px; background: var(--sunken); box-shadow: inset 0 0 0 1px var(--line); transition: background var(--fast), box-shadow var(--fast) }
.curve:hover { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent-line) }
.glyph path { fill: none; stroke: var(--accent); stroke-width: 1.4; stroke-linecap: round }

.hud { position: fixed; z-index: 30; transform: translate(-50%, -100%) translateY(4px); display: flex; align-items: center; gap: 8px; padding: 5px 9px; border-radius: 8px; background: var(--raised); box-shadow: var(--shadow-pop); font-size: 11.5px; pointer-events: none; opacity: 0; transition: opacity var(--fast), transform var(--fast) var(--ease); white-space: nowrap }
.hud.on { opacity: 1; transform: translate(-50%, -100%) }
.hud-name { color: var(--text-3) }
.hud-value { font: 500 11.5px var(--mono); font-variant-numeric: tabular-nums; color: var(--text) }
.hud-track { width: 56px; height: 3px; border-radius: 2px; background: var(--line-strong); position: relative; overflow: hidden }
.hud-track i { position: absolute; inset: 0 auto 0 0; background: var(--scrub); border-radius: 2px }

/* right column */
#right > * { flex: none }
#right { overflow: auto; min-width: 0; padding: 12px 12px 48px; display: flex; flex-direction: column; gap: 12px; scrollbar-width: thin }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm) }
#stage { position: relative; display: grid; place-items: center; padding: 28px; min-height: 240px; overflow: hidden; background-color: var(--sunken); background-image: radial-gradient(var(--line-strong) 0.8px, transparent 0.8px); background-size: 14px 14px; background-position: 7px 7px; transition: border-color var(--slow) }
#stage.preview { border-color: var(--accent-line) }
#art { width: 100%; transition: opacity var(--slow) var(--ease) }
#stage.stale #art { opacity: 0.4; filter: saturate(0.6) }
#badge { position: absolute; top: 10px; right: 10px; display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--raised); box-shadow: var(--shadow-pop); color: var(--text-2); font-size: 11.5px; opacity: 0; transform: translateY(-2px); transition: opacity var(--fast), transform var(--fast) var(--ease); pointer-events: none }
#badge.on { opacity: 1; transform: none }
#badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--accent) }
.stage-empty { color: var(--text-3); text-align: center; display: grid; gap: 4px; padding: 48px 0 }
.stage-empty b { color: var(--text); font-weight: 500; font-size: 14px }

#transport { display: flex; align-items: center; gap: 12px; padding: 0 2px }
#toggle { min-width: 84px; justify-content: center }
#clock { font: 500 13px var(--mono); font-variant-numeric: tabular-nums; color: var(--text) }
#clock-total { font: 13px var(--mono); font-variant-numeric: tabular-nums; color: var(--text-3) }
#loop-note { color: var(--text-3); font-size: 12px }

.banner { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--danger-soft); border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent); color: var(--text) }
.banner svg { width: 16px; height: 16px; margin-top: 1px; fill: none; stroke: var(--danger); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round }
.banner b { font-weight: 600; display: block }
.banner .why { color: var(--text-2); font-size: 12px; margin-top: 1px }
.banner pre { margin: 8px 0 0; font: 12px/18px var(--mono); color: var(--danger); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 9rem; overflow: auto }
#warnings { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; color: var(--text-2); font-size: 12px }
#warnings li { padding: 6px 10px; border-radius: 8px; background: var(--sunken) }
#warnings:empty { display: none }

.panel { padding: 12px 14px 14px }
.panel-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; min-height: 20px }
.panel-head h2 { margin: 0; font-size: 12px; font-weight: 600; color: var(--text); letter-spacing: 0 }
.panel-head .note { color: var(--text-3); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.panel-head .spacer { flex: 1 }
.empty { color: var(--text-3); font-size: 12px; margin: 0 }
.variants-head { margin: 12px 0 8px }

/* timeline */
#timeline { --label: 196px; --t: 0; position: relative; user-select: none }
.ruler, .row { display: grid; grid-template-columns: var(--label) minmax(0, 1fr) }
.ruler { height: 24px; position: relative; scrollbar-gutter: stable; overflow: hidden }
.scale { position: relative; cursor: col-resize; border-bottom: 1px solid var(--line) }
.tick { position: absolute; bottom: 5px; transform: translateX(-50%); font: 10.5px var(--mono); font-variant-numeric: tabular-nums; color: var(--text-3); pointer-events: none }
.tick:first-child { transform: none }
.tick:last-of-type:not(:first-child) { transform: translateX(-100%) }
.knob { position: absolute; left: calc(var(--t) * 100%); bottom: -5px; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: var(--playhead); box-shadow: 0 0 0 2px var(--surface); z-index: 3; pointer-events: none }
.scale::after { content: ""; position: absolute; left: calc(var(--t) * 100%); bottom: 0; height: 6px; width: 1.5px; margin-left: -0.75px; background: var(--playhead) }
.rows { max-height: 340px; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; scrollbar-width: thin; padding-bottom: 2px }
.row { height: 26px; align-items: center; border-radius: 6px; transition: background var(--fast) }
.row:hover { background: var(--hover) }
.lane-label { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 0 10px 0 6px; height: 100% }
.lane-label .name { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 0 }
.lane-label .prop { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 0; min-width: 0; font-size: 12px }
.lane-label .count { font: 10.5px var(--mono); font-variant-numeric: tabular-nums; color: var(--text-3); background: var(--sunken); border-radius: 999px; padding: 0 6px; line-height: 16px; flex: none }
.row.child .lane-label { padding-left: 28px }
.row.child .name { color: var(--text-2) }
.fold { display: inline-grid; place-items: center; width: 16px; height: 16px; margin-left: -2px; color: var(--text-3); flex: none; border-radius: 4px }
.fold:hover { background: var(--press); color: var(--text) }
.chev { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; transition: transform var(--slow) var(--ease) }
.row.open .chev { transform: rotate(90deg) }
.track { position: relative; height: 100%; background-image: linear-gradient(to right, var(--line) 1px, transparent 1px); background-size: var(--grid, 10%) 100%; background-position: -0.5px 0 }
.track::after { content: ""; position: absolute; top: 0; bottom: 0; left: calc(var(--t) * 100%); width: 1.5px; margin-left: -0.75px; background: var(--playhead); pointer-events: none; z-index: 2 }
.row:first-child .track::after { top: -1px }
.bar { position: absolute; top: 6px; bottom: 6px; min-width: 3px; border-radius: 4px; background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent); overflow: hidden; transition: background var(--fast), box-shadow var(--fast) }
.bar svg { position: absolute; inset: 3px 3px; width: calc(100% - 6px); height: calc(100% - 6px); overflow: visible }
.bar path { fill: none; stroke: var(--accent); stroke-width: 1.25; stroke-linecap: round; opacity: 0.9 }
.row:hover .bar { background: color-mix(in srgb, var(--accent) 20%, transparent) }
.bar.live { cursor: grab; background: color-mix(in srgb, var(--accent) 22%, transparent); box-shadow: inset 0 0 0 1px var(--accent-line) }
.bar.live:hover { background: color-mix(in srgb, var(--accent) 30%, transparent) }
.bar.moving { cursor: grabbing; box-shadow: inset 0 0 0 1.5px var(--accent), 0 2px 8px -2px var(--accent-line) }
.grip { position: absolute; right: 0; top: 0; bottom: 0; width: 8px; cursor: ew-resize }
.grip::after { content: ""; position: absolute; right: 2px; top: 3px; bottom: 3px; width: 2px; border-radius: 1px; background: var(--accent); opacity: 0; transition: opacity var(--fast) }
.bar.live:hover .grip::after, .bar.stretching .grip::after { opacity: 0.8 }
.track.crowded .bar { background: color-mix(in srgb, var(--accent) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent) }
.row:hover .track.crowded .bar { background: color-mix(in srgb, var(--accent) 14%, transparent) }
.more { color: var(--text-3); font-size: 12px; margin: 8px 0 0 6px }

#stats { display: flex; align-items: center; gap: 12px; padding: 0 4px; color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; min-height: 20px }
#stats-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0 }
#stats-text b { color: var(--text-2); font-weight: 500 }
#stats-text .sep { color: var(--text-4); margin: 0 6px }
#download { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); text-decoration: none; font-weight: 500; white-space: nowrap; border-radius: 6px; padding: 2px 4px; margin-right: -4px; transition: background var(--fast) }
#download:hover { background: var(--accent-soft) }
#download svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round }

/* frames and variants */
.strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px }
.strip:empty { display: none }
.frame { display: grid; gap: 6px; justify-items: center; padding: 0; min-width: 0; border-radius: 8px; color: var(--text-3); font-size: 11px }
.frame > div { width: 100%; aspect-ratio: var(--aspect, 16 / 9); border-radius: 8px; overflow: hidden; background: var(--sunken); box-shadow: inset 0 0 0 1px var(--line); display: grid; place-items: center; transition: box-shadow var(--fast) }
.frame:hover > div { box-shadow: inset 0 0 0 1px var(--line-strong), 0 0 0 3px var(--hover) }
.frame.now > div { box-shadow: 0 0 0 1.5px var(--accent) }
.frame.now span { color: var(--accent) }
.frame span { font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100% }
.frame.dim { color: var(--danger); font-size: 11px; padding: 8px; text-align: center }
#variants.rows-grid { display: grid; gap: 8px }
.variant-row { display: grid; grid-template-columns: 64px repeat(6, minmax(0, 1fr)); gap: 8px; align-items: start }
.variant-row.times > span { font: 10.5px var(--mono); color: var(--text-3); text-align: center; padding: 0 }
.variant-row .frame span:empty { display: none }
.variant-row > span { font: 11.5px var(--mono); color: var(--text-2); padding-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.segmented { display: inline-flex; padding: 2px; border-radius: 7px; background: var(--sunken); box-shadow: inset 0 0 0 1px var(--line) }
.segmented button { height: 22px; padding: 0 9px; border-radius: 5px; font-size: 11.5px; color: var(--text-2); transition: background var(--fast), color var(--fast) }
.segmented button[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm), 0 0 0 1px var(--line) }
.close { color: var(--text-3) }

/* inspector and composed controls */
.group { display: grid; gap: 2px }
.group h2 { display: none }
.control { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 6px 8px; margin: 0 -8px; border-radius: 8px; transition: background var(--fast) }
.control:hover, .control.hot { background: var(--hover) }
.control .label { padding: 0; height: auto; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block }
.control .label.scrub { cursor: ew-resize; user-select: none; text-decoration: underline dotted var(--scrub); text-decoration-thickness: 1.5px; text-underline-offset: 4px }
.control .value { display: flex; gap: 6px; align-items: center }
.control input[type="number"], .control input[type="text"], .control select { height: 26px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--surface); padding: 0 8px; font: 12px var(--mono); font-variant-numeric: tabular-nums; transition: border-color var(--fast), box-shadow var(--fast) }
.control input[type="number"] { width: 10ch; text-align: right }
.control input[type="text"] { width: 14rem }
.control input:focus, .control select:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-soft) }
.control .dim { color: var(--text-3); font: 12px var(--mono) }
.ghost { height: 24px; padding: 0 8px; border-radius: 6px; font-size: 12px; color: var(--text-2); transition: background var(--fast), color var(--fast) }
.ghost:hover { background: var(--hover); color: var(--text) }
.meter { grid-column: 1 / -1; height: 3px; border-radius: 2px; background: var(--line); position: relative; overflow: hidden }
.meter i { position: absolute; inset: 0 auto 0 0; background: var(--scrub); border-radius: 2px }
.picks { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px }
.picks .swatch { margin: 0 }
input[type="color"] { width: 26px; height: 26px; padding: 0; border: 0; background: none; cursor: pointer }
.pad { grid-column: 1 / -1; position: relative; width: 100%; aspect-ratio: 2.4; max-height: 180px; background: var(--sunken); background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 12.5% 20%; border: 1px solid var(--line); border-radius: 8px; cursor: crosshair; touch-action: none }
.pad i { position: absolute; width: 12px; height: 12px; margin: -6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); pointer-events: none }
.inspect-title { display: flex; align-items: baseline; gap: 8px; min-width: 0 }
.inspect-title h2 { margin: 0; font-size: 12px; font-weight: 600 }
#inspect-control .control .label { font: 500 12.5px var(--mono) }
.inspect-title span { color: var(--text-3); font-size: 12px; white-space: nowrap }

/* history */
#log ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; max-height: 12rem; overflow: auto }
#log li { display: flex; align-items: center; gap: 8px; padding: 4px 8px; margin: 0 -8px; border-radius: 6px; font: 12px var(--mono); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
#log li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--line-strong); flex: none }
#log li.last { color: var(--text); background: var(--hover) }
#log li.last::before { background: var(--accent) }
#log li.undone { color: var(--text-4); text-decoration: line-through }

/* popovers */
.pop { position: fixed; z-index: 40; width: 248px; padding: 12px; border-radius: 12px; background: var(--raised); box-shadow: var(--shadow-pop); display: grid; gap: 10px; opacity: 0; transform: translateY(-4px) scale(0.98); transform-origin: top left; transition: opacity var(--fast), transform var(--slow) var(--ease) }
.pop.on { opacity: 1; transform: none }
.pop-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px }
.pop-title { font: 600 12px var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.pop-value { font: 12px var(--mono); color: var(--text-3); white-space: nowrap }
.pop-color { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 8px }
.pop-color input[type="color"] { width: 32px; height: 30px; border-radius: 7px; overflow: hidden }
.pop-color input[type="color"]::-webkit-color-swatch-wrapper { padding: 0 }
.pop-color input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 7px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15) }
.pop-hex { height: 30px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--surface); padding: 0 10px; font: 12.5px var(--mono); text-transform: uppercase }
.pop-hex:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-soft) }
.pop-label { font-size: 11px; color: var(--text-3); margin-bottom: -4px }
.pop-swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px }
.pop-swatch { aspect-ratio: 1; border-radius: 6px; background: var(--c); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12); transition: transform var(--fast) var(--ease), box-shadow var(--fast) }
.pop-swatch:hover { transform: scale(1.1) }
.pop-swatch[aria-current="true"] { box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12), 0 0 0 2px var(--raised), 0 0 0 3.5px var(--accent) }
.pop-ease { width: 280px }
.pop-presets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px }
.pop-preset { display: grid; justify-items: center; gap: 2px; padding: 6px 0 4px; border-radius: 8px; font-size: 10.5px; color: var(--text-2); transition: background var(--fast), color var(--fast) }
.pop-preset:hover { background: var(--hover); color: var(--text) }
.pop-preset[aria-current="true"] { background: var(--accent-soft); color: var(--text) }
.pop-editor { justify-self: center; width: 100%; height: auto; max-width: 200px; overflow: visible; touch-action: none }
.pop-editor .box { fill: var(--sunken); stroke: var(--line-strong); rx: 4px }
.pop-editor .diag { stroke: var(--line-strong); stroke-dasharray: 2 3; fill: none }
.pop-editor .arm { stroke: var(--text-3); stroke-width: 1 }
.pop-editor .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round }
.pop-editor .handle { fill: var(--raised); stroke: var(--accent); stroke-width: 2; cursor: grab; transition: r var(--fast) }
.pop-editor .handle:hover { r: 6.5px }
.pop-hint { font-size: 11px; color: var(--text-3); text-align: center; margin-top: -4px }

body.no-scene #code-pane > .code, body.no-scene .chrome > *:not(.lights), body.no-scene #transport, body.no-scene #right > section, body.no-scene #stats { visibility: hidden }
body.no-scene #right > section, body.no-scene #stats, body.no-scene #transport { display: none }
body.no-scene #stage { min-height: 420px }
.code-empty { display: grid; place-content: center; gap: 4px; height: 100%; color: var(--text-3); text-align: center; font: 13px var(--sans) }

@media (max-width: 1360px) {
  #layout { grid-template-columns: 184px minmax(380px, 1fr) minmax(440px, 1fr) }
  #timeline { --label: 156px }
}
@media (max-width: 1100px) {
  #layout, #layout.single { grid-template-columns: minmax(0, 1fr); overflow: auto }
  #picker { display: none }
  #code-pane { margin: 12px 12px 0; height: 60vh }
  body { overflow: auto }
}
`;
