import { hyphenate } from '../../src/compiler/utilities';

let eventCmds = { delegate: 1, capture: 1, call: 1 };

export type TChildNode = Node | string | undefined | null;

export function h(name: string, attrs: Record<string, any>, ...children: TChildNode[]) {
  let el = document.createElement(name);
  if (attrs) {
    let value;
    for (let attr in attrs) {
      value = attrs[attr];
      if (attr === 'class' || attr === 'className' || attr === 'cls') {
        value = value === undefined || value === null ? [] : Array.isArray(value) ? value : ('' + value).split(' ');
        el.classList.add(...value);
      } else if (attr in el || attr === 'data' || attr[0] === '_') {
        el[attr] = value;
      } else if (attr === 'asElement' || attr === 'as-element') {
        el.setAttribute('as-element', value);
      } else {
        if (attr[0] === 'o' && attr[1] === 'n') {
          let decoded = hyphenate(attr.substr(2));
          let parts = decoded.split('-');
          if (parts.length > 1) {
            let lastPart = parts[parts.length - 1];
            let cmd = eventCmds[lastPart] === 1 ? lastPart : 'trigger';
            el.setAttribute(`${parts.slice(0, -1).join('-')}.${cmd}`, value);
          } else {
            el.setAttribute(`${parts[0]}.trigger`, value);
          }
        } else {
          let lastIdx = attr.lastIndexOf('$');
          if (lastIdx === -1) {
            el.setAttribute(hyphenate(attr), value);
          } else {
            let cmd = attr.substr(lastIdx + 1);
            cmd = cmd ? hyphenate(cmd) : 'bind';
            el.setAttribute(`${hyphenate(attr.substr(0, lastIdx))}.${cmd}`, value);
          }
        }
      }
    }
  }
  let appender = (el instanceof HTMLTemplateElement) ? el.content : el;
  for (let child of children) {
    if (child === null || child === undefined) {
      continue;
    }
    appender.appendChild(child instanceof Node ? child : document.createTextNode('' + child));
  }
  return el;
}

export function html(parts: TemplateStringsArray, ...expressions: any[]): string {
  return parts.join('');
}

// for template literal highlighting
// and template element creation
// export function html(parts: TemplateStringsArray, ...expressions: any[]): HTMLTemplateElement {
//   const parser = document.createElement('div');
//   parser.innerHTML = parts.join('');
//   const template = parser.firstElementChild;
//   if (/template/i.test(template.tagName)) {
//     return template as HTMLTemplateElement;
//   }
//   throw new Error('Invalid template. Should be wrapped inside a <template></template> element.');
// }
