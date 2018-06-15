// import { Aurelia } from '../../../src/runtime/aurelia';
import { IViewCompiler } from '../../../src/compiler/view-compiler';
import { expect } from 'chai';
// import { spy } from 'sinon';
import { html } from '../h';
import { IContainer, DI } from '../../../src/runtime/di';
import { IResourcesContainer } from '../../../src/compiler/resources-container';
import { TargetedInstructionType, IOneWayBindingInstruction, ISetAttributeInstruction, IListenerBindingInstruction, ITwoWayBindingInstruction, IHydrateAttributeInstruction, IHydrateElementInstruction } from '../../../src/runtime/templating/instructions';
import { DelegationStrategy } from '../../../src/runtime/binding/event-manager';
import { Repeat } from '../../../src/runtime/resources/repeat/repeat';
import { IAttributeType, IElementType } from '../../../src/runtime/templating/component';
import { If } from '../../../src/runtime/resources/if';
import { Else } from '../../../src/runtime/resources/else';
import { customElement, bindable } from '../../../src/runtime/decorators';
import { BindingMode } from '../../../src/runtime/binding/binding-mode';

// export interface ITemplateSource {
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

describe('ViewCompiler', () => {

  let template: string;

  let container: IContainer;
  let resources: IResourcesContainer;
  let compiler: IViewCompiler;

  beforeEach(() => {
    container = DI.createContainer();
    resources = container.get(IResourcesContainer);
    compiler = container.get(IViewCompiler);
  });

  it('compiles', () => {
    template = html`
      <template>
        <div id="d1" class.bind="cls" data-id.bind="id" textcontent.bind="text" aria-value.bind="value"></div>
      </template>
    `;
    const templateSource = compiler.compile(template, resources);
    expect(templateSource).not.to.be.undefined.and.not.to.be.null;
    expect(templateSource.template).equals(html`
      <template>
        <div id="d1" class="au"></div>
      </template>
    `.trim());

    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    const firstInstructionSet = templateSource.instructions[0];
    expect(firstInstructionSet).to.be.instanceOf(Array, 'There should be at least one instruction set.');
    expect(firstInstructionSet.length).to.eqls(4, 'There should be 4 binding instructions.');

    const [
      classBinding,
      dataIdBinding,
      textContentBinding,
      ariaValueBinding,
    ] = firstInstructionSet as [
      IOneWayBindingInstruction,
      IOneWayBindingInstruction,
      IOneWayBindingInstruction,
      ISetAttributeInstruction
    ];

    expect(classBinding.type).to.eqls(TargetedInstructionType.oneWayBinding, 'Class binding should have type of one way binding');
    expect(classBinding.src).to.eqls('cls', 'Class binding should get value from "src" property.');
    expect(classBinding.dest).to.eqls('class', 'Class binding should set value on "class" property of element.');

    expect(dataIdBinding.type).to.eqls(TargetedInstructionType.oneWayBinding, '"bind" command binding should have type of oneway');
    expect(dataIdBinding.src).to.eq('id', 'data-id.bind=id should have src value "id"');
    expect(dataIdBinding.dest).to.eq('data-id', 'data-id.bind=id should target "data-id"');

    expect(textContentBinding.type).to.eq(TargetedInstructionType.oneWayBinding, '"bind" command binding should have type of oneway');
    expect(textContentBinding.src).to.eq('text');
  });

  it('compiles attribute interpolation', () => {
    template = html`
      <template>
        <div data-id="Hello \${message}!"></div>
      </template>
    `;
    const templateSource = compiler.compile(template, resources);
    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    const firstInstructionSet = templateSource.instructions[0];
    expect(firstInstructionSet).to.be.instanceOf(Array, 'There should be at least one instruction set.');
    expect(firstInstructionSet.length).to.eqls(1, 'There should be 1 binding instructions.');

    const [
      dataIdBinding
    ] = firstInstructionSet as [
      IOneWayBindingInstruction
    ];

    expect(dataIdBinding.dest).to.eq('data-id');
    expect(dataIdBinding.src).to.eq('Hello ${message}!');
  });

  it('compiles text content interpolation', () => {
    template = html`
      <template>
        <div>
          Hello \${message}!
        </div>
      </template>
    `;
    const templateSource = compiler.compile(template, resources);
    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    const firstInstructionSet = templateSource.instructions[0];
    expect(firstInstructionSet).to.be.instanceOf(Array, 'There should be at least one instruction set.');
    expect(firstInstructionSet.length).to.eqls(1, 'There should be 1 binding instructions.');
  });

  it('compiles event listeners', () => {
    template = html`
      <template>
        <div click.delegate='hello()'></div>
        <span click.trigger='spam()'></span>
        <a click.capture='block()'></a>
      </template>
    `;
    const templateSource = compiler.compile(template, resources);
    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    expect(templateSource.instructions.length).to.eql(3, 'There should be 3 instruction set.');

    const [
      [delegateExpression],
      [clickExpression],
      [captureExpression]
    ] = templateSource.instructions as IListenerBindingInstruction[][];

    expect(delegateExpression.type === clickExpression.type
      && delegateExpression.type === captureExpression.type
      && delegateExpression.type === TargetedInstructionType.listenerBinding
    ).to.eq(
      true,
      'Listener bindings should have type listener binding type'
    );

    expect(delegateExpression.strategy).to.eq(DelegationStrategy.bubbling, '.delegate should have listener strategy of "bubbling"');
    expect(clickExpression.strategy).to.eq(DelegationStrategy.none, '.trigger should have listener strategy of "none"');
    expect(captureExpression.strategy).to.eq(DelegationStrategy.capturing, '.capture should have listener strategy of "capturing"');
  });

  it('creates right binding mode', () => {
    template = html`
      <template>
        <input value.bind='message'>
        <input type="checkbox" checked.bind='checked'>
        <fieldset>
          <input type="radio" name="theme" value="dark" checked.bind="theme">
          <input type="radio" name="theme" value="light" checked.bind="theme">
        </fieldset>
        <div contenteditable textcontent.bind="desc"></div>
        <div contenteditable innerhtml.bind="error"></div>
        <div scrolltop.bind="logPosition"></div>
        <div scrollleft.bind="horizontalPosition"></div>
        <textarea value.bind="feedback"></textarea>
      </template>
    `;

    const templateSource = compiler.compile(template, resources);
    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    expect(templateSource.instructions.length).to.eql(9, 'There should be 9 instruction sets.');

    expect(templateSource.template).to.eq(html`
      <template>
        <input class="au">
        <input type="checkbox" class="au">
        <fieldset>
          <input type="radio" name="theme" value="dark" class="au">
          <input type="radio" name="theme" value="light" class="au">
        </fieldset>
        <div contenteditable="" class="au"></div>
        <div contenteditable="" class="au"></div>
        <div class="au"></div>
        <div class="au"></div>
        <textarea class="au"></textarea>
      </template>
    `.trim());

    const [
      [messageExpression],
      [checkedExpression],
      [darkThemeCheckedExpression],
      [lightThemeCheckedExpression],
      [descExpression],
      [errorExpression],
      [logPositionExpression],
      [horizontalPositionExpression],
      [feedbackExpression]
    ] = templateSource.instructions as ITwoWayBindingInstruction[][];

    expect(messageExpression.type === checkedExpression.type
      && messageExpression.type === darkThemeCheckedExpression.type
      && messageExpression.type === lightThemeCheckedExpression.type
      && messageExpression.type === descExpression.type
      && messageExpression.type === errorExpression.type
      && messageExpression.type === logPositionExpression.type
      && messageExpression.type === horizontalPositionExpression.type
      && messageExpression.type === feedbackExpression.type
      && messageExpression.type === TargetedInstructionType.twoWayBinding
    ).to.eq(
      true,
      '"bind" command should create two way binding for input, checkbox and radio'
    );
  });

  describe('Custom Attribute', () => {

    beforeEach(() => {
      resources.registerAttribute(Repeat as any);
      resources.registerAttribute(If as any);
      resources.registerAttribute(Else as any);
    });

    it('compiles custom attribute', () => {
      template = html`
        <template>
          <div if.bind="condition"></div>
        </template>
      `;

      const templateSource = compiler.compile(template, resources);
      expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
      expect(templateSource.instructions.length).to.eq(1, 'There should be 1 instruction set.');

      const [
        [ifExpression]
      ] = templateSource.instructions as [
        [IHydrateAttributeInstruction]
      ];

      expect(ifExpression.type === TargetedInstructionType.hydrateAttribute).to.eq(true, '"if" attribute should have type "hydrateAttribute"');
    });

    it('compiles custom attribute with options', () => {
      // First 2 are for primary property
      // second 2 are for expanded syntax
      template = html`
        <template>
          <div square="red"></div>
          <div square.bind="squareColor"></div>
          <div square="color: red"></div>
          <div square="color.bind: squareColor"></div>
          <div square="color.bind: squareColor; size: 100"></div>
          <div square="color.bind: squareColor; size.bind: squareSize"></div>
        </template>
      `;

      const templateSource = compiler.compile(template, resources);
      expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
      expect(templateSource.instructions.length).to.eq(1, 'There should be 1 instruction set.');

      const [
        [plainPrimaryExpession],
        [plainPrimaryBindExpression],
        [expandedExpression],
        [expandedBindExpression],
        [expandedMultipleExpression],
        [expandedMultipleBindExpression]
      ] = templateSource.instructions as [IHydrateAttributeInstruction][];

      expect(
        plainPrimaryExpession.type === plainPrimaryBindExpression.type
        && plainPrimaryExpession.type === expandedExpression.type
        && plainPrimaryExpession.type === expandedBindExpression.type
        && plainPrimaryExpession.type === expandedMultipleExpression.type
        && plainPrimaryExpession.type === expandedMultipleBindExpression.type
        && plainPrimaryExpession.type === TargetedInstructionType.hydrateAttribute
      ).to.eq(true, 'custom attribute bindings should have type attribute');

      // ...
    });
  });

  describe('Custom Element', () => {

    it('compiles custom element', () => {

      @customElement('app')
      class App {

        @bindable({
          mode: BindingMode.twoWay
        })
        name: string;
      }

      resources.registerElement(App as any);

      template = html`
        <template>
          <app name.bind="message"></app>
        </template>
      `;

      const templateSource = compiler.compile(template, resources);
      expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
      expect(templateSource.instructions.length).to.eq(1, 'There should be 1 instruction set.');

      const [
        [appInstructions]
      ] = templateSource.instructions as [
        [IHydrateElementInstruction]
      ];

      expect(appInstructions.instructions.length).to.eq(
        1,
        '"app" element should have 1 binding instruction'
      );
      expect(appInstructions.instructions[0].type).to.eq(
        TargetedInstructionType.twoWayBinding,
        '"name" binding mode should be "twoWay"'
      );
    });
  });
});
