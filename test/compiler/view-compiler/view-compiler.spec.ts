// import { Aurelia } from '../../../src/runtime/aurelia';
import { IViewCompiler } from '../../../src/compiler/view-compiler';
import { expect } from 'chai';
// import { spy } from 'sinon';
import { html } from '../h';
import { IContainer, DI } from '../../../src/runtime/di';

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
  let compiler: IViewCompiler;

  beforeEach(() => {
    container = DI.createContainer();
    compiler = container.get(IViewCompiler);
    template = html`
      <template>
        <div class.bind="cls"></div>
      </template>
    `;
  });

  it('compiles', () => {
    const templateSource = compiler.compile(template, container);
    expect(templateSource).not.to.be.undefined.and.not.to.be.null;
    expect(templateSource.template).equals(template);
    // expect(templateSource.surrogates).to.be.instanceOf(Array);
    expect(templateSource.instructions).to.be.instanceOf(Array, 'Template source should have instructions.');
    expect(templateSource.instructions[0]).to.be.instanceOf(Array, 'There should be at least one instruction set.');
  });
});
