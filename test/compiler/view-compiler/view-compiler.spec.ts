// import { Aurelia } from '../../../src/runtime/aurelia';
import { IViewCompiler } from '../../../src/compiler/view-compiler';
import { expect } from 'chai';
// import { spy } from 'sinon';
import { html } from '../h';
import { IContainer, DI } from '../../../src/runtime/di';
import { IResourcesContainer } from '../../../src/compiler/resources-container';
import { TargetedInstructionType, IOneWayBindingInstruction, ISetAttributeInstruction, IListenerBindingInstruction } from '../../../src/runtime/templating/instructions';
import { DelegationStrategy } from '../../../src/runtime/binding/event-manager';

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

describe.only('ViewCompiler', () => {

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
    // expect(templateSource.surrogates).to.be.instanceOf(Array);
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
});
