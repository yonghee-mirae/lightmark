// M1: displays raw text only and accepts drag & drop. Markdown rendering lands in M2.

export interface FileDropDetail {
  name: string;
  content: string;
}

export class LmViewer extends HTMLElement {
  connectedCallback(): void {
    this.renderEmpty();
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('drop', this.handleDrop);
  }

  setRawContent(content: string): void {
    this.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'lm-raw';
    pre.textContent = content;
    this.appendChild(pre);
  }

  private renderEmpty(): void {
    this.innerHTML = '<p class="lm-empty">Drop a Markdown file here, or use Open.</p>';
  }

  private handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };

  private handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then((content) => {
      this.dispatchEvent(
        new CustomEvent<FileDropDetail>('lm-file-drop', {
          bubbles: true,
          detail: { name: file.name, content },
        }),
      );
    });
  };
}

customElements.define('lm-viewer', LmViewer);
