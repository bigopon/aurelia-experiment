import { DI, IContainer } from '../runtime/di';
import {
  ITemplateSource,
  TemplateDefinition,
  IAttributeSource,
  IBindableInstruction,
  TargetedInstructionType,
  ITargetedInstruction,
  IListenerBindingInstruction,
  TargetedInstruction
} from '../runtime/templating/instructions';
import * as CompilerUtils from './utilities';
import { IAttributeType } from '../runtime/templating/component';
import { DelegationStrategy } from '../runtime/binding/event-manager';

export interface IViewCompiler {
  compile(template: string, resources: IContainer): ITemplateSource;
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
  compile(template: string, resources: IContainer): ITemplateSource {

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

  private compileNode(source: ITemplateSource, node: Node, resources: IContainer): Node {
    switch (node.nodeType) {
      case CompilerUtils.NodeType.Element: //element node
        return this.compileElement(source, node as Element, resources);
      case CompilerUtils.NodeType.Text: //text node
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

  private compileElement(source: ITemplateSource, node: Element, resources: IContainer): Node {
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'slot') {
      throw new Error('<slot/> not implemented.');
    }
    const targetInstructions: TargetedInstruction[] = [];
    // const isElement = CompilerUtils.isKnownElement(tagName, resources);
    const isElement = false;
    const vmClass = isElement ? resources.get(tagName) : undefined;
    const definition: TemplateDefinition = isElement ? vmClass.definition : undefined;
    const elementProperties: Record<string, IBindableInstruction> = isElement && definition.observables || Object.create(null);

    const attributes = node.attributes;

    for (let i = 0, ii = attributes.length; ii > i; ++i) {
      const attr = attributes[i];
      const attrName = attr.nodeName;
      const isCustomAttribute = false && CompilerUtils.isKnownAttribute(
        attrName,
        resources
      );
      const attrVm: IAttributeType = isCustomAttribute ? resources.get(attrName) : undefined;
      const attrComponent = isCustomAttribute ? attrVm.definition : undefined;
      if (isCustomAttribute) {
        throw new Error('Custom attribute not implemented.');
      }
      if (isElement) {
        const bindableInstruction = elementProperties[attrName];
        if (bindableInstruction) {
          targetInstructions.push({
            type: TargetedInstructionType.listenerBinding,
            src: 'click',
            dest: 'submit',
            preventDefault: true,
            strategy: DelegationStrategy.none
          } as IListenerBindingInstruction);
        }
      } else if (isCustomAttribute) {

      } else {
        targetInstructions.push({
          type: TargetedInstructionType.setProperty,
          value: attrName,
          dest: attr.value
        });
      }
    }
    if (targetInstructions.length > 0) {
      source.instructions.push(targetInstructions);
    }
    return node.nextSibling;
  }
}


