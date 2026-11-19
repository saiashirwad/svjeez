// A card whose look lives in its open shadow root; the light DOM fills its slots.
class XCard extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        :host { display: block; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; }
        header { padding: 8px 12px; background: #1e3a8a; color: #fff; font-weight: 600; }
        .body { padding: 12px; background: #eff6ff; }
        ::slotted(p) { margin: 0 0 6px; color: #b91c1c; }
        footer { padding: 8px 12px; background: #dbeafe; color: #475569; }
      </style>
      <header><slot name="title">Untitled</slot></header>
      <div class="body"><slot></slot></div>
      <footer><slot name="foot">Fallback footer</slot></footer>
    `;
  }
}

customElements.define("x-card", XCard);
