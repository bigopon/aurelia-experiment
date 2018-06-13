// import { Aurelia } from '../../../src/runtime/aurelia';
import { IViewCompiler } from '../../../src/compiler/view-compiler';
import { expect } from 'chai';
// import { spy } from 'sinon';
import { html } from '../h';
import { IContainer, DI } from '../../../src/runtime/di';
import { IResourcesContainer } from '../../../src/compiler/resources-container';
import { TargetedInstructionType, IOneWayBindingInstruction, ISetAttributeInstruction } from '../../../src/runtime/templating/instructions';

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
        <div class.bind="cls" data-id.bind='id' textcontent.bind='text' aria-value.bind='value'></div>
      </template>
    `;
    const templateSource = compiler.compile(template, resources);
    expect(templateSource).not.to.be.undefined.and.not.to.be.null;
    expect(templateSource.template).equals(template);
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
      ISetAttributeInstruction,
      IOneWayBindingInstruction,
      ISetAttributeInstruction
    ];
    expect(classBinding.type).to.eqls(TargetedInstructionType.oneWayBinding, 'Class binding should have type of one way binding');
    expect(classBinding.src).to.eqls('cls', 'Class binding should get value from "src" property.');
    expect(classBinding.dest).to.eqls('class', 'Class binding should set value on "class" property of element.');

    expect(dataIdBinding.type).to.eqls(TargetedInstructionType.setAttribute, 'data-* binding should have type of attribute.');
    expect(dataIdBinding.value).to.eq('id', 'data-id.bind=id should have value "id"');
    expect(dataIdBinding.dest).to.eq('data-id', 'data-id.bind=id should target "data-id"');

    expect(textContentBinding.type).to.eq(TargetedInstructionType.textBinding, 'TextContent binding should have type of text binding');
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
      ISetAttributeInstruction
    ];

    expect(dataIdBinding.dest).to.eq('data-id');
    expect(dataIdBinding.value).not.to.eq('Hello ${message}!');
  });

  it('compiles text content', () => {
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
});
