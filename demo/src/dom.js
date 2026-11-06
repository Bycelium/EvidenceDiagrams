export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') node.className = value;
    else if (key === 'textContent') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}

export function safeHttpUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
