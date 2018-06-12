import { IContainer } from '../runtime/di';
import { TemplateDefinition } from '../runtime/templating/instructions';

const hyphenateResultCache: Record<string, string> = {};
const capitalMatcher = /([A-Z])/g;
function addHyphenAndLower(char) {
  return '-' + char.toLowerCase();
}
export function hyphenate(name: string) {
  if (name in hyphenateResultCache) {
    return hyphenateResultCache[name];
  }
  const result = (name.charAt(0).toLowerCase() + name.slice(1)).replace(capitalMatcher, addHyphenAndLower);
  return hyphenateResultCache[name] = result;
}

export function isKnownElement(name: string, container: IContainer): boolean {
  name = name.toLowerCase();
  const resolver = container.getResolver(name);
  if (!resolver) {
    return false;
  }
  const vmClass = container.get(name);
  if (typeof vmClass !== 'function') {
    return false;
  }
  const definition: TemplateDefinition = vmClass.definition;
  if (!definition || definition.name !== name) {
    return false;
  }
  return true;
}

export function isKnownAttribute(name: string, container: IContainer): boolean {
  name = name.toLowerCase();
  const resolver = container.getResolver(name);
  if (!resolver) {
    return false;
  }
  const vmClass = container.get(name);
  if (typeof vmClass !== 'function') {
    return false;
  }
  const definition: TemplateDefinition = vmClass.definition;
  if (!definition || definition.name !== name) {
    return false;
  }
  return true;
}

export const enum NodeType {
  Element = 1,
  Text = 3,
  DocumentFragment = 11
}
