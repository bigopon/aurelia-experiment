import { expect } from 'chai';
import { IElementType, IAttributeType } from './../../../src/runtime/templating/component';
import { IResourcesContainer } from '../../../src/compiler/resources-container';
import { IContainer, DI } from '../../../src/runtime/di';
import { TemplateDefinition } from '../../../src/runtime/templating/instructions';
import { customElement, customAttribute } from '../../../src/runtime/decorators';

describe('ViewResources', () => {
  let container: IContainer;
  let resources: IResourcesContainer;

  beforeEach(() => {
    container = DI.createContainer();
    resources = container.get(IResourcesContainer);
  });

  describe('registration', () => {

    it('registers elements', () => {

      @customElement('app')
      class App {
      }

      resources.registerElement(App as IElementType);
      expect(resources.getElement('app')).to.eq(App, 'It should register App custom element');
    });

    it('registers attributes', () => {

      @customAttribute('date-picker')
      class DatePicker {

      }

      resources.registerAttribute(DatePicker as IAttributeType);
      expect(resources.getAttribute('date-picker')).to.eq(DatePicker, 'It should register DatePicker custom attribute');
    });

    it('throws when register element with same name', () => {

      @customElement('app')
      class App {
      }

      resources.registerElement(App as IElementType);

      @customElement('app')
      class App2 {

      }
      expect(() => resources.registerElement(App2 as IElementType)).to.throw(
        /^Element with same name already exists\.$/,
        'It should throw when register element with same name already existed.'
      );
    });

    it('throws when register element with same name', () => {

      @customAttribute('date-picker')
      class DatePicker {
      }

      resources.registerAttribute(DatePicker as IAttributeType);

      @customAttribute('date-picker')
      class DatePicker2 {

      }
      expect(() => resources.registerAttribute(DatePicker2 as IAttributeType)).to.throw(
        /^Attribute with same name already exists\.$/,
        'It should throw when registering attribute with same name already existed.'
      );
    });
  });

  describe('hierarchy', () => {
    it('gets element from parent', () => {

      let resources2 = container.get(IResourcesContainer);
      resources2.parent = resources;

      @customElement('app')
      class App {
      }

      resources.registerElement(App as IElementType);
      expect(resources.getElement('app')).to.eq(App, 'It should register App custom element');
      expect(resources2.getElement('app')).to.eq(App, 'It should get App custom element from parent');
    });

    it('gets attribute from parent', () => {

      let resources2 = container.get(IResourcesContainer);
      resources2.parent = resources;

      @customAttribute('date-picker')
      class DatePicker {
      }

      resources.registerAttribute(DatePicker as IAttributeType);
      expect(resources.getAttribute('date-picker')).to.eq(DatePicker, 'It should register DatePicker custom attribute');
      expect(resources2.getAttribute('date-picker')).to.eq(DatePicker, 'It should get DatePicker custom attribute from parent');
    });

    it('throws when element exists in parent', () => {

      let resources2 = container.get(IResourcesContainer);
      resources2.parent = resources;

      @customElement('app')
      class App {
      }

      @customElement('app')
      class App2 {

      }

      resources.registerElement(App as IElementType);
      expect(() => resources2.registerElement(App2 as IElementType)).to.throw(
        /^Element with same name already exists\.$/,
        'It should throw when register element with same name already existed.'
      );
    });

    it('throws when attribute exists in parent', () => {

      let resources2 = container.get(IResourcesContainer);
      resources2.parent = resources;

      @customAttribute('date-picker')
      class DatePicker {
      }

      @customAttribute('date-picker')
      class DatePicker2 {

      }

      resources.registerAttribute(DatePicker as IAttributeType);
      expect(() => resources2.registerAttribute(DatePicker2 as IAttributeType)).to.throw(
        /^Attribute with same name already exists\.$/,
        'It should throw when register attribute with same name already existed.'
      );
    });
  });
});
