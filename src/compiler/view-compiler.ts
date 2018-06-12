import { IOneWayBindingInstruction, ITwoWayBindingInstruction } from './../runtime/templating/instructions';
import { DI, IContainer } from '../runtime/di';
import {
  ITemplateSource,
  TemplateDefinition,
  IAttributeSource,
  IBindableInstruction,
  TargetedInstructionType,
  ITargetedInstruction,
  IListenerBindingInstruction,
  TargetedInstruction,
  ISetAttributeInstruction,
  ISetPropertyInstruction
} from '../runtime/templating/instructions';
import * as CompilerUtils from './utilities';
import { IAttributeType } from '../runtime/templating/component';
import { DelegationStrategy } from '../runtime/binding/event-manager';
import { IBindingLanguage, IAttrInfo } from './binding-language';
import { IResourcesContainer } from './resources-container';
import { BindingMode } from '../runtime/binding/binding-mode';
import { Immutable } from '../runtime/interfaces';

export interface IViewCompiler {
  compile(template: string, resources: IResourcesContainer): ITemplateSource;
}

export const IViewCompiler = DI.createInterface<IViewCompiler>()
  .withDefault(x => x.singleton(ViewCompiler));


// interface ITemplateSource {
//   name?: string;
//   template?: string;
//   instructions?: Array<TargetedInstruction[]>;
//   dependencies?: any[];
//   surrogates?: TargetedInstruction[];
//   observables?: Record<string, IBindableInstruction>;
//   containerless?: boolean;
//   shadowOptions?: ShadowRootInit;
//   hasSlots?: boolean;
// }

class ViewCompiler implements IViewCompiler {

  static inject = [IBindingLanguage];

  constructor(
    private bindingLanguage: IBindingLanguage
  ) {

  }

  compile(template: string, resources: IResourcesContainer): ITemplateSource {

    const templateDef: TemplateDefinition = {
      name: 'Unknown',
      template: template,
      containerless: false,
      shadowOptions: { mode: 'open' },
      hasSlots: false,
      observables: {},
      dependencies: [],
      instructions: [],
      surrogates: [],
    };

    const templateSource: ITemplateSource = {
      template: template,
      instructions: []
    };

    const templateRootEl = this.parse(template);
    const rootNode = 'content' in templateRootEl ? (templateRootEl as HTMLTemplateElement).content : templateRootEl;

    this.compileNode(templateSource, rootNode, resources);

    return templateSource;
  }

  parse(template: string): HTMLElement {
    const parser = document.createElement('div');
    parser.innerHTML = template;
    const el = parser.firstElementChild;
    if (el) {
      return el as HTMLElement;
    }
    throw new Error(`Invalid template: [${template}]`);
  }

  private compileNode(source: ITemplateSource, node: Node, resources: IResourcesContainer): Node {
    switch (node.nodeType) {
      case CompilerUtils.NodeType.Element:
        return this.compileElement(source, node as Element, resources);
      case CompilerUtils.NodeType.Text:
        //use wholeText to retrieve the textContent of all adjacent text nodes.
        // let expression = resources.getBindingLanguage(this.bindingLanguage).inspectTextContent(resources, node.wholeText);
        // if (expression) {
        //   let marker = DOM.createElement('au-marker');
        //   let auTargetID = makeIntoInstructionTarget(marker);
        //   (node.parentNode || parentNode).insertBefore(marker, node);
        //   node.textContent = ' ';
        //   instructions[auTargetID] = TargetInstruction.contentExpression(expression);
        //   //remove adjacent text nodes.
        //   while (node.nextSibling && node.nextSibling.nodeType === 3) {
        //     (node.parentNode || parentNode).removeChild(node.nextSibling);
        //   }
        // } else {
        //   //skip parsing adjacent text nodes.
        //   while (node.nextSibling && node.nextSibling.nodeType === 3) {
        //     node = node.nextSibling;
        //   }
        // }
        return node.nextSibling;
      case CompilerUtils.NodeType.DocumentFragment:
        let currentChild = node.firstChild;
        while (currentChild) {
          currentChild = this.compileNode(source, currentChild, resources);
        }
        break;
      default:
        break;
    }

    return node.nextSibling;
  }

  private compileElement(source: ITemplateSource, node: Element, resources: IResourcesContainer): Node {
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'slot') {
      throw new Error('<slot/> compilation not implemented.');
    }
    const targetInstructions: TargetedInstruction[] = [];
    // const isElement = CompilerUtils.isKnownElement(tagName, resources);
    const vmClass = resources.getElement(tagName);
    const isElement = vmClass !== undefined;
    const elDefinition: TemplateDefinition = isElement ? vmClass.definition : undefined;
    const elementProps: Record<string, IBindableInstruction> = isElement && elDefinition.observables || Object.create(null);

    const attributes = node.attributes;
    const bindingLanguage = this.bindingLanguage;

    // let bindingLanguage: IBindingLanguage = resources.get(IBindingLanguage);

    for (let i = 0, ii = attributes.length; ii > i; ++i) {
      const attr = attributes[i];
      const attrName = attr.nodeName;
      const attrValue = attr.value;
      const attributeInfo = bindingLanguage.inspectAttribute(resources, tagName, attrName, attrValue);
      const attrVm: IAttributeType = resources.getAttribute(attrName);
      const isCustomAttribute = attrVm !== undefined;
      // const attrComponent = isCustomAttribute ? attrVm.definition : undefined;
      if (isCustomAttribute) {
        throw new Error('Custom attribute compilation not implemented.');
      }
      if (isElement) {
        const bindableInstruction = elementProps[attributeInfo.attrName];
        if (bindableInstruction) {
          targetInstructions.push(this.determineInstruction(attributeInfo, bindableInstruction));
        }
      } else if (isCustomAttribute) {

      } else {
        const isSetAttribute = /^data-|aria-|w+:/.test(attrName);
        let instruction: TargetedInstruction;
        if (isSetAttribute) {
          instruction = {
            type: TargetedInstructionType.setAttribute,
            value: attributeInfo.attrValue,
            dest: attributeInfo.attrName
          } as ISetAttributeInstruction;
        } else {
          instruction = {
            type: TargetedInstructionType.oneWayBinding,
            dest: attributeInfo.attrName,
            src: attributeInfo.attrValue,
          } as IOneWayBindingInstruction;
        }
        targetInstructions.push(instruction);
      }
    }
    if (targetInstructions.length > 0) {
      source.instructions.push(targetInstructions);
    }
    return node.nextSibling;
  }

  private determineInstruction(
    info: Immutable<IAttrInfo>,
    bindableInstruction: IBindableInstruction
  ): TargetedInstruction {
    if (info.command === 'bind') {
      switch (bindableInstruction.mode) {
        case BindingMode.oneTime:
          return {
            type: TargetedInstructionType.setProperty,
            value: info.attrValue,
            dest: info.attrName
          } as ISetPropertyInstruction;
        case BindingMode.toView:
        default:
          return {
            type: TargetedInstructionType.oneWayBinding,
            src: info.attrValue,
            dest: info.attrName
          } as IOneWayBindingInstruction;
        case BindingMode.twoWay:
          return {
            type: TargetedInstructionType.twoWayBinding,
            src: info.attrValue,
            dest: info.attrName
          } as ITwoWayBindingInstruction;
        case BindingMode.toView:
          return {
            type: TargetedInstructionType.oneWayBinding,
            src: info.attrValue,
            dest: info.attrName
          } as IOneWayBindingInstruction;
      }
    }
  }
}


