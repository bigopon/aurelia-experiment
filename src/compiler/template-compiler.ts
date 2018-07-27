import { IOneWayBindingInstruction, ITwoWayBindingInstruction, ITextBindingInstruction, IHydrateAttributeInstruction, IHydrateElementInstruction } from '../runtime/templating/instructions';
// import { DI, IContainer } from '../runtime/di';
import {
  ITemplateSource,
  TemplateDefinition,
  TargetedInstructionType,
  ITargetedInstruction,
  IListenerBindingInstruction,
  TargetedInstruction,
  ISetAttributeInstruction,
  ISetPropertyInstruction
} from '../runtime/templating/instructions';
import * as CompilerUtils from './utilities';
import { DelegationStrategy } from '../runtime/binding/event-manager';
import { IBindingLanguage, IAttrInfo } from './binding-language';
import { IResourcesContainer } from './resources-container';
import { BindingMode } from '../runtime/binding/binding-mode';
import { PrimitiveLiteral, IExpression, HtmlLiteral } from '../runtime/binding/ast';
import { IExpressionParser } from '../runtime/binding/expression-parser';
import { ITemplateCompiler } from '../runtime/templating/template-compiler';
import { IResourceDescriptions } from '../runtime/resource';
import { Immutable } from '../kernel/interfaces';
import { ICustomElementType, CustomElementResource } from '../runtime/templating/custom-element';
import { CustomAttributeResource } from '../runtime/templating/custom-attribute';


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

type IWritable<T> = {
  -readonly [K in keyof T]: IWritable<T[K]>
}

class TemplateCompiler implements ITemplateCompiler {

  static inject = [IBindingLanguage, IExpressionParser];


  private emptyStringExpression = new PrimitiveLiteral('');

  name: string = 'default';

  constructor(
    private bindingLanguage: IBindingLanguage,
    private parser: IExpressionParser,
  ) {

  }

  compile(definition: TemplateDefinition, resources: IResourceDescriptions): TemplateDefinition {

    // compile(template: string, resources: IResourcesContainer): TemplateDefinition {

    const templateDef: Writable<TemplateDefinition> = {
      name: 'Unknown',
      build: {
        required: false,
        compiler: this.name
      },
      cache: -1,
      template: definition.template,
      containerless: false,
      shadowOptions: { mode: 'open' },
      hasSlots: false,
      bindables: {},
      dependencies: [],
      instructions: [],
      surrogates: [],
    };

    // const templateSource: ITemplateSource = {
    //   template: template,
    //   instructions: []
    // };

    const templateRootEl = this.parse(definition.template);
    const rootNode = 'content' in templateRootEl ? (templateRootEl as HTMLTemplateElement).content : templateRootEl;

    this.compileNode(templateDef, rootNode, resources);

    // Re-define template. This is the compiled template with very different structure
    templateDef.template = templateRootEl.outerHTML;

    return templateDef;
  }

  private parse(template: string): HTMLElement {
    const parser = document.createElement('div');
    parser.innerHTML = template;
    const el = parser.firstElementChild;
    if (el) {
      return el as HTMLElement;
    }
    throw new Error(`Invalid template: [${template}]`);
  }

  /**
   * Compile a node and return next node for the next compilation
   */
  private compileNode(source: IWritable<TemplateDefinition>, node: Node, resources: IResourceDescriptions): Node {
    switch (node.nodeType) {
      case CompilerUtils.NodeType.Element:
        return this.compileElement(source, node as Element, resources);
      case CompilerUtils.NodeType.Text:
        //use wholeText to retrieve the textContent of all adjacent text nodes.
        const wholeText = (node as Text).wholeText || '';
        const expression = this.parseInterpolation(wholeText);
        if (expression) {
          const marker = document.createElement('au-marker');
          this.markAsInstructionTarget(marker);
          // TODO: handle <template/>
          if (!node.parentNode) {
            throw new Error('Nested <template/> not implemented.');
          }
          node.parentNode.insertBefore(marker, node);
          node.textContent = ' ';
          //remove adjacent text nodes
          while (node.nextSibling && node.nextSibling.nodeType === CompilerUtils.NodeType.Text) {
            node.parentNode.removeChild(node.nextSibling);
          }
          source.instructions.push([
            { type: TargetedInstructionType.textBinding, src: wholeText } as ITextBindingInstruction
          ]);
        } else {
          //skip parsing adjacent text nodes
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

  /**
   * Compile an element and then all of its children
   */
  private compileElement(source: IWritable<TemplateDefinition>, node: Element, resources: IResourceDescriptions): Node {
    const elementName = (node.getAttribute('as-element') || node.tagName).toLowerCase();
    if (elementName === 'slot') {
      throw new Error('<slot/> compilation not implemented.');
    } else if (elementName === 'template') {
      throw new Error('Nested <template/> compilation not implemented');
    }
    const targetInstructions: TargetedInstruction[] = [];
    // const isElement = CompilerUtils.isKnownElement(tagName, resources);
    const vmClass = resources.get(CustomElementResource, elementName);
    const isElement = vmClass !== undefined;
    const elDefinition: TemplateDefinition = isElement ? vmClass.definition : undefined;
    const elementProps: Record<string, IBindableInstruction> = isElement && (vmClass as any).observables || Object.create(null);

    const attributes = node.attributes;

    let elementInstruction: IHydrateElementInstruction;

    if (isElement) {
      targetInstructions.push(elementInstruction = {
        type: TargetedInstructionType.hydrateElement,
        res: elementName,
        instructions: []
      } as IHydrateElementInstruction);
    }

    // res: 'name-tag',
    //   instructions: [
    //     {
    //       type: TargetedInstructionType.twoWayBinding,
    //       src: 'message',
    //       dest: 'name'
    //     },
    //     {
    //       type: TargetedInstructionType.refBinding,
    //       src: 'nameTag'
    //     }
    //   ]

    // let bindingLanguage: IBindingLanguage = resources.get(IBindingLanguage);

    const toRemoveAttrs = [];

    for (let i = 0, ii = attributes.length; ii > i; ++i) {
      const attr = attributes[i];
      const attrName = attr.nodeName;
      const attrValue = attr.value;
      const attributeInfo = this.inspectAttribute(resources, elementName, attrName, attrValue);
      const attrVm: AttributeDefinition = resources.get(CustomAttributeResource, attributeInfo.attrName);
      const isCustomAttribute = attrVm !== undefined;
      let targetInstruction: TargetedInstruction;
      if (isElement) {
        const bindableInstruction = elementProps[attributeInfo.attrName];
        if (bindableInstruction) {
          elementInstruction.instructions.push(this.determineInstruction(attributeInfo, bindableInstruction));
        }
      } else if (isCustomAttribute) {
        targetInstruction = {
          type: TargetedInstructionType.hydrateAttribute,

        } as IHydrateAttributeInstruction;
      } else {
        targetInstruction = this.determineCustomElementBinding(node, attributeInfo);
      }
      if (targetInstruction !== undefined) {
        targetInstructions.push(targetInstruction);
        toRemoveAttrs.push(attrName);
      }
    }
    // cannot check for either alone, 
    // element can consume all attribute bindings
    // or there is no element at all
    if (isElement || targetInstructions.length > 0) {
      this.markAsInstructionTarget(node);

      source.instructions.push(targetInstructions);

      for (let attr of toRemoveAttrs) {
        node.removeAttribute(attr);
      }
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

  private determineCustomElementBinding(
    element: Element,
    { attrName, attrValue, command, expression }: Immutable<IAttrInfo>,
  ): TargetedInstruction {
    let instruction: TargetedInstruction;
    if (expression) {
      instruction = {
        type: TargetedInstructionType.oneWayBinding,
        src: attrValue,
        dest: attrName
      } as IOneWayBindingInstruction;
    } else if (command) {
      // TODO: handle dynamic - extensible command syntax
      // instead of fixed list like following
      if (command === 'trigger' || command === 'delegate' || command === 'capture') {
        instruction = {
          type: TargetedInstructionType.listenerBinding,
          src: attrName,
          dest: attrValue,
          preventDefault: true,
          strategy: command === 'trigger'
            ? DelegationStrategy.none
            : command === 'delegate'
              ? DelegationStrategy.bubbling
              : DelegationStrategy.capturing
        } as IListenerBindingInstruction;
      } else if (command === 'one-way') {

      } else if (command === 'one-time') {

      } else if (command === 'two-way') {

      } else if (command === 'bind') {
        instruction = {
          type: this.determineElementBindingMode(element, element.tagName.toLowerCase(), attrName),
          src: attrValue,
          dest: attrName
        } as TargetedInstruction;
      }
    }
    return instruction;
  }

  private determineCustomAttributeBinding(
    info: IAttrInfo
  ) {
    const attrInstruction: IHydrateAttributeInstruction = {
      type: TargetedInstructionType.hydrateAttribute,
      res: info.attrName,
      instructions: []
    };
  }

  private parseCustomAttributeExpression(
    resources: IResourcesContainer,
    info: IAttrInfo,
    instruction: IHydrateAttributeInstruction
  ) {
    let attrValue = info.attrValue;
    let name = null;
    let target = '';
    let current;
    let i;
    let ii;
    let inString = false;
    let inEscape = false;
    let foundName = false;

    for (i = 0, ii = attrValue.length; i < ii; ++i) {
      current = attrValue[i];

      if (current === ';' && !inString) {
        if (!foundName) {
          name = this.getPrimaryPropertyName(resources, instruction);
        }
        const partInfo = this.inspectAttribute(resources, '?', name, target.trim());
        // language.createAttributeInstruction(resources, element, partInfo, instruction, context);

        if (!instruction.attributes[partInfo.attrName]) {
          instruction.attributes[partInfo.attrName] = partInfo.attrValue;
        }

        target = '';
        name = null;
      } else if (current === ':' && name === null) {
        foundName = true;
        name = target.trim();
        target = '';
      } else if (current === '\\') {
        target += current;
        inEscape = true;
        continue;
      } else {
        target += current;

        if (name !== null && inEscape === false && current === '\'') {
          inString = !inString;
        }
      }

      inEscape = false;
    }

    // check for the case where we have a single value with no name
    // and there is a default property that we can use to obtain
    // the name of the property with which the value should be associated.
    if (!foundName) {
      name = this.getPrimaryPropertyName(resources, context);
    }

    if (name !== null) {
      partInfo = language.inspectAttribute(resources, '?', name, target.trim());
      language.createAttributeInstruction(resources, element, partInfo, instruction, context);

      if (!instruction.attributes[partInfo.attrName]) {
        instruction.attributes[partInfo.attrName] = partInfo.attrValue;
      }
    }

    return instruction;
  }

  private getPrimaryPropertyName(resources: IResourcesContainer, instruction: IHydrateAttributeInstruction): string | null {
    let type = resources.getAttribute(instruction.res);
    if (type && type.observables) {
      return type.definition.primaryProperty.attribute;
    }
    return null;
  }

  private determineElementBindingMode(
    element: Element & Partial<HTMLInputElement>,
    tagName: string,
    attrName: string
  ): TargetedInstructionType {
    if (tagName === 'input' && (attrName === 'value' || attrName === 'files') && element.type !== 'checkbox' && element.type !== 'radio'
      || tagName === 'input' && attrName === 'checked' && (element.type === 'checkbox' || element.type === 'radio')
      || (tagName === 'textarea' || tagName === 'select') && attrName === 'value'
      || (attrName === 'textcontent' || attrName === 'innerhtml') && element.contentEditable === 'true'
      || attrName === 'scrolltop'
      || attrName === 'scrollleft'
    ) {
      return TargetedInstructionType.twoWayBinding;
    }
    return TargetedInstructionType.oneWayBinding;
  }

  private inspectAttribute(resources: IResourcesContainer, elementName: string, attrName: string, attrValue: string): Immutable<IAttrInfo> {
    const parts = attrName.split('.');
    const command = parts.length === 2 ? parts[1].trim() : '';
    const expression = this.parseInterpolation(attrValue);

    if (expression !== null && command !== '') {
      throw new Error('Invalid attribute expression. Cannot support both binding command and interpolation expression.');
    }

    attrName = parts[0].trim();
    return {
      attrName: attrName,
      command: command,
      attrValue: attrValue,
      expression: expression,
    };
    // sharedInspectionInfo.attrName = attrName;
    // sharedInspectionInfo.command = command;
    // sharedInspectionInfo.attrValue = attrValue;
    // sharedInspectionInfo.expression = expression;
    // return sharedInspectionInfo;
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


