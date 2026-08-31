export const CSS = `
  * { box-sizing: border-box; }
  .kb-root {
    min-height: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: var(--text);
    background: var(--bg);
    font-family: var(--font);
    overflow: hidden;
  }
  .kb-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 10px;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
  }
  .kb-title-wrap { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .kb-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: var(--font);
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: 8px;
    width: 100%;
    min-width: 0;
  }
  .kb-title:focus { outline: 2px solid var(--accent); outline-offset: 0; }
  .kb-title[readonly], .kb-col-name[readonly], .kb-input[readonly] { cursor: default; }
  .kb-title-static { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; padding: 2px 4px; margin: -2px -4px; }
  .kb-sub { font-size: 12px; color: var(--muted); padding: 0 4px; }
  .kb-divider {
    max-width: 1068px;
    width: calc(100% - 32px);
    margin: 0 auto;
    border-bottom: 1px solid var(--border);
  }
  .kb-board {
    flex: 1;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 14px 16px 18px;
    scroll-snap-type: x proximity;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
    align-items: flex-start;
  }
  .kb-col {
    flex: 0 0 auto;
    width: min(78vw, 300px);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    scroll-snap-align: start;
  }
  .kb-col.kb-drop { border-color: var(--accent); }
  .kb-col-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 8px 14px;
  }
  .kb-col-name {
    font-size: 14px;
    font-weight: 600;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: var(--font);
    padding: 4px 6px;
    margin: -4px -6px;
    border-radius: 8px;
    flex: 1;
    min-width: 0;
  }
  .kb-col-name:focus { outline: 2px solid var(--accent); outline-offset: 0; }
  .kb-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface-2);
    border-radius: 999px;
    padding: 2px 8px;
    min-width: 24px;
    text-align: center;
  }
  .kb-iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    flex: 0 0 auto;
  }
  .kb-iconbtn:hover { background: var(--surface-2); color: var(--text); }
  .kb-iconbtn:focus-visible { outline: 2px solid var(--accent); }
  .kb-backbtn { margin-left: -8px; width: 36px; height: 36px; }
  .kb-cards {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 2px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 8px;
  }
  .kb-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    cursor: grab;
    touch-action: pan-x pan-y;
    user-select: none;
    -webkit-user-select: none;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    transition: box-shadow 120ms ease, transform 120ms ease;
  }
  .kb-card:active { cursor: grabbing; }
  .kb-card.kb-readonly { cursor: pointer; }
  .kb-card-title { font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
  .kb-card-notes { font-size: 12px; color: var(--muted); margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .kb-label { width: 34px; height: 4px; border-radius: 2px; margin-bottom: 7px; }
  .kb-card.kb-lifted { opacity: 0.35; }
  .kb-ghost {
    position: fixed;
    z-index: 50;
    pointer-events: none;
    transform: rotate(2.5deg);
    box-shadow: 0 12px 32px rgba(0,0,0,0.25);
    opacity: 0.95;
  }
  .kb-gap {
    border: 1.5px dashed var(--accent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .kb-addcard {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 10px 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    padding: 10px 8px;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
  }
  .kb-addcard:hover { background: var(--surface-2); color: var(--text); }
  .kb-addcard:focus-visible { outline: 2px solid var(--accent); }
  .kb-composer { margin: 4px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
  .kb-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    padding: 10px 12px;
    resize: none;
  }
  .kb-input:focus { outline: 2px solid var(--accent); border-color: transparent; }
  .kb-composer-row { display: flex; gap: 8px; }
  .kb-btn {
    border: none;
    border-radius: 10px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    cursor: pointer;
    min-height: 36px;
  }
  .kb-btn-primary { background: var(--accent); color: #fff; }
  .kb-btn-quiet { background: transparent; color: var(--muted); }
  .kb-btn-quiet:hover { background: var(--surface-2); color: var(--text); }
  .kb-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .kb-addcol {
    flex: 0 0 auto;
    width: 220px;
    border: 1.5px dashed var(--border);
    border-radius: 16px;
    background: transparent;
    color: var(--muted);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 18px 12px;
    cursor: pointer;
  }
  .kb-addcol:hover { color: var(--text); border-color: var(--muted); }
  .kb-addcol:focus-visible { outline: 2px solid var(--accent); }
  .kb-empty {
    font-size: 12.5px;
    color: var(--muted);
    text-align: center;
    padding: 10px 8px 4px;
  }
  .kb-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 60;
    animation: kb-fade 140ms ease;
  }
  .kb-sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 84%;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    z-index: 61;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: kb-rise 180ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  @keyframes kb-rise { from { transform: translate(-50%, 24px); opacity: 0; } }
  @keyframes kb-fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .kb-sheet, .kb-scrim { animation: none; }
    .kb-card { transition: none; }
    .kb-tile { transition: none; }
  }
  .kb-sheet-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto; }
  .kb-sheet-row { display: flex; align-items: center; gap: 10px; }
  .kb-sheet h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
  .kb-swatches { display: flex; gap: 10px; }
  .kb-swatch {
    width: 30px; height: 30px;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .kb-swatch.kb-on { border-color: var(--text); }
  .kb-swatch.kb-none { background: var(--surface-2); position: relative; }
  .kb-swatch.kb-none::after {
    content: '';
    position: absolute; inset: 6px 13px;
    transform: rotate(45deg);
    border-left: 2px solid var(--muted);
  }
  .kb-swatch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .kb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .kb-chip {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 13px;
    border-radius: 999px;
    padding: 8px 14px;
    cursor: pointer;
    min-height: 36px;
  }
  .kb-chip.kb-on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .kb-chip:focus-visible { outline: 2px solid var(--accent); }
  .kb-danger { color: #ef4444; }
  .kb-danger:hover { background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; }
  .kb-offline {
    font-size: 12px;
    color: var(--muted);
    background: var(--surface-2);
    border-radius: 999px;
    padding: 4px 10px;
    flex: 0 0 auto;
  }

  /* Boards home */
  .kb-home {
    flex: 1;
    overflow-y: auto;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
    padding: 14px 16px 24px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 12px;
    align-content: start;
  }
  .kb-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    min-height: 110px;
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    color: var(--text);
    transition: border-color 120ms ease, transform 120ms ease;
  }
  .kb-tile:hover { border-color: var(--accent); transform: translateY(-1px); }
  .kb-tile:focus-visible { outline: 2px solid var(--accent); }
  .kb-tile-title { font-size: 16px; font-weight: 650; overflow-wrap: anywhere; padding-right: 30px; }
  .kb-tile-meta { font-size: 12.5px; color: var(--muted); margin-top: auto; }
  .kb-tile-bars { display: flex; gap: 4px; }
  .kb-tile-bar { height: 4px; border-radius: 2px; background: var(--surface-2); flex: 1; }
  .kb-tile-bar.kb-fill { background: var(--accent); opacity: 0.6; }
  .kb-tile-del { position: absolute; top: 10px; right: 10px; }
  .kb-newtile {
    border-style: dashed;
    border-width: 1.5px;
    background: transparent;
    color: var(--muted);
    align-items: center;
    justify-content: center;
    flex-direction: row;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  .kb-newtile:hover { color: var(--text); }
  .kb-home-empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
    padding: 40px 16px 8px;
  }
`
