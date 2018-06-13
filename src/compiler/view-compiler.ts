import { IOneWayBindingInstruction, ITwoWayBindingInstruction, ITextBindingInstruction } from './../runtime/templating/instructions';
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
import { PrimitiveLiteral, IExpression, HtmlLiteral } from '../runtime/binding/ast';
import { IExpressionParser } from '../runtime/binding/expression-parser';

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

  static inject = [IBindingLanguage, IExpressionParser];


  private emptyStringExpression = new PrimitiveLiteral('');

  constructor(
    private bindingLanguage: IBindingLanguage,
    private parser: IExpressionParser,
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
        const expression = this.parseInterpolation((node as Text).wholeText || '');
        if (expression) {
          const marker = document.createElement('au-marker');
          this.markAsInstructionTarget(marker);
          // TODO: handle <template/>
          if (!node.parentNode) {
            throw new Error('Nested <template/> not implemented.');
          }
          node.parentNode.insertBefore(marker, node);
          node.textContent = ' ';
          //remove adjacent text nodes.
          while (node.nextSibling && node.nextSibling.nodeType === CompilerUtils.NodeType.Text) {
            node.parentNode.removeChild(node.nextSibling);
          }
          source.instructions.push([
            { type: TargetedInstructionType.textBinding, src: expression.toString() } as ITextBindingInstruction
          ]);
        } else {
          //skip parsing adjacent text nodes.
          while (node.nextSibling && node.nextSibling.nodeType === CompilerUtils.NodeType.Text) {
            node = node.nextSibling;
          }
        }
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
    const elementName = node.tagName.toLowerCase();
    if (elementName === 'slot') {
      throw new Error('<slot/> compilation not implemented.');
    }
    const targetInstructions: TargetedInstruction[] = [];
    // const isElement = CompilerUtils.isKnownElement(tagName, resources);
    const vmClass = resources.getElement(elementName);
    const isElement = vmClass !== undefined;
    const elDefinition: TemplateDefinition = isElement ? vmClass.definition : undefined;
    const elementProps: Record<string, IBindableInstruction> = isElement && elDefinition.observables || Object.create(null);

    const attributes = node.attributes;
    // const bindingLanguage = this.bindingLanguage;

    // let bindingLanguage: IBindingLanguage = resources.get(IBindingLanguage);

    for (let i = 0, ii = attributes.length; ii > i; ++i) {
      const attr = attributes[i];
      const attrName = attr.nodeName;
      const attrValue = attr.value;
      const attributeInfo = this.inspectAttribute(resources, elementName, attrName, attrValue);
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
        targetInstructions.push(this.determineElementBinding(attributeInfo));
      }
    }
    if (targetInstructions.length > 0) {
      source.instructions.push(targetInstructions);
    }

    let currentChild = node.firstChild;
    while (currentChild) {
      currentChild = this.compileNode(source, currentChild, resources);
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

  private determineElementBinding(
    { attrName, attrValue }: Immutable<IAttrInfo>,
  ): TargetedInstruction {
    const isSetAttribute = /^data-|aria-|w+:/.test(attrName);
    let instruction: TargetedInstruction;
    if (isSetAttribute) {
      instruction = {
        type: TargetedInstructionType.setAttribute,
        value: attrValue,
        dest: attrName
      } as ISetAttributeInstruction;
    } else if (attrName === 'textcontent') {
      instruction = {
        type: TargetedInstructionType.textBinding,
        src: attrValue
      } as ITextBindingInstruction;
    } else {
      instruction = {
        type: TargetedInstructionType.oneWayBinding,
        dest: attrName,
        src: attrValue,
      } as IOneWayBindingInstruction;
    }
    return instruction;
  }

  private inspectAttribute(resources: IResourcesContainer, elementName: string, attrName: string, attrValue: string): Immutable<IAttrInfo> {
    const parts = attrName.split('.');
    const command = parts.length === 2 ? parts[1].trim() : '';
    const expression = this.parseInterpolation(attrValue);

    if (expression !== null && command !== '') {
      throw new Error('Invalid attribute expression. Cannot support both binding command and interpolation expression.');
    }

    attrName = parts[0].trim();
    sharedInspectionInfo.attrName = attrName;
    sharedInspectionInfo.command = command;
    sharedInspectionInfo.attrValue = attrValue;
    sharedInspectionInfo.expression = expression;
    return sharedInspectionInfo;
  }

  private parseInterpolation(value: string): HtmlLiteral | null {
    let i = value.indexOf('${', 0);
    let ii = value.length;
    let char;
    let pos = 0;
    let open = 0;
    let quote = null;
    let interpolationStart;
    let parts: IExpression[];
    let partIndex = 0;

    while (i >= 0 && i < ii - 2) {
      open = 1;
      interpolationStart = i;
      i += 2;

      do {
        char = value[i];
        i++;

        if (char === "'" || char === '"') {
          if (quote === null) {
            quote = char;
          } else if (quote === char) {
            quote = null;
          }
          continue;
        }

        if (char === '\\') {
          i++;
          continue;
        }

        if (quote !== null) {
          continue;
        }

        if (char === '{') {
          open++;
        } else if (char === '}') {
          open--;
        }
      } while (open > 0 && i < ii);

      if (open === 0) {
        // lazy allocate array
        parts = parts || [];
        if (value[interpolationStart - 1] === '\\' && value[interpolationStart - 2] !== '\\') {
          // escaped interpolation
          parts[partIndex] = new PrimitiveLiteral(value.substring(pos, interpolationStart - 1) + value.substring(interpolationStart, i));
          partIndex++;
          parts[partIndex] = this.emptyStringExpression;
          partIndex++;
        } else {
          // standard interpolation
          parts[partIndex] = new PrimitiveLiteral(value.substring(pos, interpolationStart));
          partIndex++;
          parts[partIndex] = this.parser.parse(value.substring(interpolationStart + 2, i - 1));
          partIndex++;
        }
        pos = i;
        i = value.indexOf('${', i);
      } else {
        break;
      }
    }

    // no interpolation.
    if (partIndex === 0) {
      return null;
    }

    // literal.
    parts[partIndex] = new PrimitiveLiteral(value.substr(pos));
    return new HtmlLiteral(parts);
  }

  private markAsInstructionTarget(element: Element) {
    let cls = element.getAttribute('class');

    element.setAttribute('class', (cls ? cls + ' au' : 'au'));
  }
}

const sharedInspectionInfo: IAttrInfo = {};


