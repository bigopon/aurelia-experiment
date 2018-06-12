import { IElementComponent, IAttributeComponent, IElementType, IAttributeType } from './../runtime/templating/component';
import { DI } from '../runtime/di';

export interface IResourcesContainer {

  parent: IResourcesContainer;

  getElement(name: string): IElementType | undefined;
  getAttribute(name: string): IAttributeType | undefined;
}

export const IResourcesContainer = DI
  .createInterface<IResourcesContainer>()
  .withDefault(x => x.transient(ResourcesContainer));

class ResourcesContainer implements IResourcesContainer {

  private elements: Record<string, IElementType> = Object.create(null);
  private attributes: Record<string, IAttributeType> = Object.create(null);

  private hasParent: boolean;

  readonly parent: IResourcesContainer;

  constructor(parent: IResourcesContainer) {
    this.parent = parent;
    this.hasParent = !!parent;
  }

  getElement(name: string): IElementType | undefined {
    if (this.hasParent) {
      return this.parent.getElement(name);
    }
    return this.elements[name];
  }

  getAttribute(name: string): IAttributeType | undefined {
    if (this.hasParent) {
      return this.parent.getAttribute(name);
    }
    return this.attributes[name];
  }
}
