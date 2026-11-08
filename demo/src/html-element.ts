type AttributeValue = string | number | boolean | null | undefined;
type ElementAttributes = Readonly<Record<
  string,
  AttributeValue | Readonly<Record<string, string>>
>>;
type Child = Node | string | null | undefined | false;

export function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  attributes: ElementAttributes = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') node.className = String(value ?? '');
    else if (key === 'textContent') node.textContent = String(value ?? '');
    else if (key === 'dataset' && typeof value === 'object' && value !== null) {
      Object.assign(node.dataset, value);
    } else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  node.append(...children.filter((child): child is Node | string => Boolean(child)));
  return node;
}
