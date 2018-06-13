// import { DI } from '../runtime/di';
// import { IResourcesContainer } from './resources-container';
// import { IAttrInfo } from './binding-language';
// import { ITargetedInstruction, IBindableInstruction } from '../runtime/templating/instructions';
// import { IElementComponent, IElementType } from '../runtime/templating/component';

// export interface ISyntaxInterpreter {
//   interpret(resources: IResourcesContainer, element: Element, info: IAttrInfo): ITargetedInstruction | undefined;
// }

// export const ISyntaxInterpreter = DI
//   .createInterface<ISyntaxInterpreter>()
//   .withDefault(x => x.singleton(SyntaxInterpreter))

// class SyntaxInterpreter implements ISyntaxInterpreter {

//   [method: string]: (resources: IResourcesContainer, element: Element, info: IAttrInfo) => ITargetedInstruction | undefined;

//   interpret(resources: IResourcesContainer, element: Element, info: IAttrInfo): ITargetedInstruction | undefined {
//     if (info.command in this) {
//       return this[info.command](resources, element, info);
//     }

//     return this.handleUnknownCommand(resources, element, info);
//   }

//   /**
//    * for override
//    */
//   handleUnknownCommand(resources: IResourcesContainer, element: Element, info: IAttrInfo): ITargetedInstruction | undefined {
//     return undefined;
//   }

//   bind(resources: IResourcesContainer, info: IAttrInfo, type?: IElementType): ITargetedInstruction | undefined {
//     let bindableInstruction: IBindableInstruction;
//     let isElementProp = false;
//     if (type) {
//       const elementProps = type.definition.observables;
//       bindableInstruction = elementProps[info.attrName];
//       if (bindableInstruction) {

//       }
//     }
//     switch (bindableInstruction.mode) {
//       case BindingMode.oneTime:
//         return {
//           type: TargetedInstructionType.setProperty,
//           value: info.attrValue,
//           dest: info.attrName
//         } as ISetPropertyInstruction;
//       case BindingMode.toView:
//       default:
//         return {
//           type: TargetedInstructionType.oneWayBinding,
//           src: info.attrValue,
//           dest: info.attrName
//         } as IOneWayBindingInstruction;
//       case BindingMode.twoWay:
//         return {
//           type: TargetedInstructionType.twoWayBinding,
//           src: info.attrValue,
//           dest: info.attrName
//         } as ITwoWayBindingInstruction;
//       case BindingMode.toView:
//         return {
//           type: TargetedInstructionType.oneWayBinding,
//           src: info.attrValue,
//           dest: info.attrName
//         } as IOneWayBindingInstruction;
//     }
//   }
// }
