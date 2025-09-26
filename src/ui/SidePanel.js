// src/ui/SidePanel.js
export class SidePanel {
  constructor(root = document.getElementById('sidepanel')) {
    this.root = root;
    this.titleEl = document.getElementById('sp-title');
    this.bodyEl  = document.getElementById('sp-body');
    this.closeBtn = document.getElementById('sp-close');
    this.closeBtn.addEventListener('click', () => this.close());
  }
  open({ title, html }) {
    this.titleEl.textContent = title || 'Detalle';
    this.bodyEl.innerHTML = html || '';
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
  }
  close() {
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
  }
}
