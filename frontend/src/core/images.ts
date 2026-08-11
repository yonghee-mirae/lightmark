// Broken-image handling: core/markdown.ts's image renderer already adds `loading="lazy"` and the
// `lm-image` class at render time, but whether an image actually loads can only be known once the
// browser tries - that part has to happen after the HTML is in the DOM. Not a lazy/*.ts loader:
// there's no library to import, just an 'error' listener per <img>.

export function handleBrokenImages(container: ParentNode): void {
  const images = container.querySelectorAll<HTMLImageElement>('img.lm-image');
  images.forEach((img) => {
    img.addEventListener('error', () => markBroken(img), { once: true });
  });
}

function markBroken(img: HTMLImageElement): void {
  const warning = document.createElement('span');
  warning.className = 'lm-render-warning-inline';
  warning.textContent = `⚠️ Image failed to load: ${img.alt || img.getAttribute('src') || 'image'}`;
  img.replaceWith(warning);
}
