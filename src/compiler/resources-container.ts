import { DI } from '../runtime/di';
import { IAttributeType, IElementType } from './../runtime/templating/component';

export interface IResourcesContainer {

  parent: IResourcesContainer;

  registerElement(element: IElementType): void;
  getElement(name: string): IElementType | undefined;
  registerAttribute(attr: IAttributeType): void;
  getAttribute(name: string): IAttributeType | undefined;
}

export const IResourcesContainer = DI
  .createInterface<IResourcesContainer>()
  .withDefault(x => x.transient(ResourcesContainer));

class ResourcesContainer implements IResourcesContainer {

  private elements: Record<string, IElementType> = Object.create(null);
  private attributes: Record<string, IAttributeType> = Object.create(null);

  parent: IResourcesContainer;

  registerElement(element: IElementType) {
    if (this.getElement(element.definition.name)) {
      throw new Error('Element with same name already exists.');
    }
    this.elements[element.definition.name] = element;
  }

  getElement(name: string): IElementType | undefined {
    if (this.parent) {
      return this.parent.getElement(name);
    }
    return this.elements[name];
  }

  registerAttribute(attr: IAttributeType) {
    if (this.getAttribute(attr.definition.name)) {
      throw new Error('Attribute with same name already exists.');
    }
    this.attributes[attr.definition.name] = attr;
  }

  getAttribute(name: string): IAttributeType | undefined {
    if (this.parent) {
      return this.parent.getAttribute(name);
    }
    return this.attributes[name];
  }
}
