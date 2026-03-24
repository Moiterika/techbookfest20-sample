import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import Barcode from 'react-barcode';

class ReactBarcodeWrapper extends HTMLElement {
  private mountPoint: HTMLDivElement;
  private root: Root;

  constructor() {
    super();
    this.mountPoint = document.createElement('div');
    this.appendChild(this.mountPoint);
    this.root = createRoot(this.mountPoint);
  }

  connectedCallback() {
    this._upgradeProperty('value');
    this.render();
  }

  // upgrade 前に設定された own property を削除し、setter 経由で再設定する
  private _upgradeProperty(prop: string) {
    if (this.hasOwnProperty(prop)) {
      const value = (this as any)[prop];
      delete (this as any)[prop];
      (this as any)[prop] = value;
    }
  }

  get value(): string {
    return this.getAttribute('value') || '';
  }

  set value(val: string) {
    this.setAttribute('value', val);
  }

  static get observedAttributes() {
    return ['value'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const value = this.getAttribute('value') || '';
    // react-barcode throws an error if the value is empty
    if (value.trim() !== '') {
      this.root.render(<Barcode value={value} />);
    } else {
      this.root.render(<div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyItems: 'center', color: '#999' }}>No barcode value</div>);
    }
  }
}

// Ensure it's only defined once
if (!customElements.get('react-barcode')) {
  customElements.define('react-barcode', ReactBarcodeWrapper);
}
