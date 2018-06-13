import { HtmlLiteral } from '../runtime/binding/ast';
import { BindingMode } from '../runtime/binding/binding-mode';
import { DI } from '../runtime/di';
import { Immutable } from '../runtime/interfaces';
import { IResourcesContainer } from './resources-container';

export interface IAttrInfo {
  /**
   * When inspecting, properties of a custom element / custom attribute
   * may have defaultBindingMode that affect binding creation
   */
  defaultBindingMode?: BindingMode;
  /**
   * Name of the attribute, after normalisation
   * Depends on binding language implementation.
   * For default binding language, it's the part before the `.`
   */
  attrName?: string;
  /**
   * Attribute literal value or expression
   */
  attrValue?: string;
  /**
   * Binding command part of the attribute
   */
  command?: string;
  /**
   * When an attribute matches a certain number conditions
   * an expression can be extracted out before inspect any further
   */
  expression?: HtmlLiteral;
}

export interface IBindingLanguage {

  /**
   * Inspects an attribute for bindings.
   * @param resources The resources registry for the view being compiled.
   * @param elementName The element name to inspect.
   * @param attrName The attribute name to inspect.
   * @param attrValue The attribute value to inspect.
   * @return An info object with the results of the inspection.
   */
  inspectAttribute(resources: IResourcesContainer, elementName: string, attrName: string, attrValue: string): Immutable<IAttrInfo>;

  /**
   * Creates an attribute behavior instruction.
   * @param resources The resources registry for the view being compiled.
   * @param element The element that the attribute is defined on.
   * @param info The info object previously returned from inspectAttribute.
   * @param existingInstruction A previously created instruction for this attribute.
   * @return The instruction instance.
   */
  createAttributeInstruction(resources: IResourcesContainer, element: Element, info: Object, existingInstruction?: Object): Immutable<IAttrInfo>;

  /**
   * Parses the text for bindings.
   * @param resources The resources registry for the view being compiled.
   * @param value The value of the text to parse.
   * @return A binding expression.
   */
  inspectTextContent(resources: IResourcesContainer, value: string): Immutable<IAttrInfo>;
}

export const IBindingLanguage = DI.createInterface<IBindingLanguage>()
  .withDefault(x => x.singleton(BindingLanguage));

const sharedInspectionInfo: IAttrInfo = {};

class BindingLanguage implements IBindingLanguage {
  /**
    * Inspects an attribute for bindings.
    * @param resources The resources registry for the view being compiled.
    * @param elementName The element name to inspect.
    * @param attrName The attribute name to inspect.
    * @param attrValue The attribute value to inspect.
    * @return An info object with the results of the inspection.
    */
  inspectAttribute(resources: IResourcesContainer, elementName: string, attrName: string, attrValue: string): Immutable<IAttrInfo> {
    const parts = attrName.split('.');
    const command = parts[1].trim();
    attrName = parts[0].trim();
    sharedInspectionInfo.attrName = attrName;
    sharedInspectionInfo.command = command;
    sharedInspectionInfo.attrValue = attrValue;
    return sharedInspectionInfo;
  }

  /**
   * Creates an attribute behavior instruction.
   * @param resources The resources registry for the view being compiled.
   * @param element The element that the attribute is defined on.
   * @param info The info object previously returned from inspectAttribute.
   * @param existingInstruction A previously created instruction for this attribute.
   * @return The instruction instance.
   */
  createAttributeInstruction(resources: IResourcesContainer, element: Element, info: Object, existingInstruction?: Object): Immutable<IAttrInfo> {

    return sharedInspectionInfo;
  }

  /**
   * Parses the text for bindings.
   * @param resources The resources registry for the view being compiled.
   * @param value The value of the text to parse.
   * @return A binding expression.
   */
  inspectTextContent(resources: IResourcesContainer, value: string): Immutable<IAttrInfo> {


    return sharedInspectionInfo;
  }
}
