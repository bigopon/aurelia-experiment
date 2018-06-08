import * as ts from 'typescript';
import {
  // IViewResources,
  // IResource,
  resourceKind,
  IResourceElement,
  IResourceAttribute,
  // IResourceValueConverter,
  // IResourceBindingBehavior,
  IBindable,
  IResourceBehavior,
  // IAureliaModule
} from './interfaces';
// import { bindingMode } from './binding';
// import { hyphenate } from './util';
import { getBehaviorHtmlName } from './ts-util';

abstract class HtmlBehavior implements IResourceBehavior {

  url: string;
  name: string;
  htmlName: string;
  kind: resourceKind.element | resourceKind.attribute;
  // impl: ts.ClassDeclaration;
  bindables: Record<string, IBindable>;
  initializers: Record<string, ts.Expression>;
  lifeCycles: Record<string, boolean>;

  hasCreated: boolean;
  hasBind: boolean;
  hasAttached: boolean;
  hasDetached: boolean;
  hasUnbind: boolean;

  constructor(
    url: string,
    name: string
  ) {
    this.url = url;
    this.name = name;
    this.htmlName = getBehaviorHtmlName(name);
  }

  getBindable(htmlName: string): IBindable | null {
    return this.bindables[htmlName] || null;
  }

  get hasConstructor() {
    return this.lifeCycles.ctor === true;
  }
}

export class ElementResource extends HtmlBehavior implements IResourceElement {

  kind: resourceKind.element = resourceKind.element;
  htmlName: string;

  constructor(
    url: string,
    name: string,
    public bindables: Record<string, IBindable>,
    public initializers: Record<string, ts.Expression>,
    public lifeCycles: Record<string, boolean>
  ) {
    super(url, name);
  }

  get code(): ts.Expression | null {
    return null;

    // return ts.createCall(
    //   ts.createPropertyAccess(
    //     ts.createNew(
    //       ts.createIdentifier(this.impl.name.escapedText.toString()),
    //       /* type arguments */ undefined,
    //       /* arguments */undefined
    //     ),
    //     'applyTo'
    //   ),
    //   /* typeArguments */ undefined,
    //   /** arguments */
    //   [
    //     ts.createElementAccess(
    //       ts.createIdentifier(AbstractBinding.targetsAccessor),
    //       ts.createNumericLiteral(this.targetIndex.toString())
    //     ),
    //     ts.createLiteral(this.targetProperty),
    //     AbstractBinding.resolveBindingMode(this.mode),
    //     ts.createIdentifier('lookupFunctions')
    //   ]
    // );
  }
}

export class AttributeResource extends HtmlBehavior implements IResourceAttribute {

  kind: resourceKind.attribute = resourceKind.attribute;
  htmlName: string;
  templateController: boolean;
  primaryProperty?: IBindable;

  constructor(
    url: string,
    name: string,
    public bindables: Record<string, IBindable>,
    public initializers: Record<string, ts.Expression>,
    public lifeCycles: Record<string, boolean>
  ) {
    super(url, name);
    this.primaryProperty = this.getPrimaryProperty(bindables);
  }

  get code(): ts.Expression | null {
    return null;
  }

  private getPrimaryProperty(bindables: Record<string, IBindable>): IBindable | undefined {
    for (let prop in bindables) {
      let bindable = bindables[prop];
      if (bindable.primaryProperty) {
        return bindable;
      }
    }
    return undefined;
  }
}
