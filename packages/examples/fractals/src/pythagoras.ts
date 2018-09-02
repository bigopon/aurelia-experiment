// import { customElement, ObserverLocator, DOM } from "@aurelia/runtime";
// import { interpolateViridis as vivid } from 'd3-scale';

// export interface IPythagorasProps {
//   w: number;
//   x: number;
//   y: number;
//   heightFactor: number;
//   lean: number;
//   lvl: number;
//   maxlvl: number;
//   branch: 'left' | 'right' | undefined
// }

// let id = 1;

// @customElement({
//   name: 'pythagoras',
//   templateOrNode: (() => {
//     const template = DOM.createTemplate() as HTMLTemplateElement;
//     const parser = DOM.createElement('div') as any;
//     parser.innerHTML = ''
//     return template;
//   })(),
// })
// export class Pythagoras implements IPythagorasProps {

//   static inject = [Element];

//   // id = id++;

//   w: number;

//   x: number;

//   y: number;

//   heightFactor: number

//   lean: number;

//   lvl: number;

//   maxlvl: number;

//   left: boolean = false;

//   right: boolean = false;

//   renderLeft: boolean;
//   renderRight: boolean;

//   transform: string;
//   fill: string;
//   nextRight: number = 0;
//   nextLeft: number = 0;
//   A: number = 0;
//   B: number = 0;

//   branch: 'left' | 'right' | undefined;

//   leftScale: number;
//   rightScale: number;

//   @observable()
//   leftNode: Pythagoras;

//   @observable()
//   rightNode: Pythagoras;

//   readonly rect: SVGRectElement;

//   private lastestProp: IPythagorasProps;

//   constructor(
//     readonly element: SVGGElement,
//     readonly taskQueue: TaskQueue,
//   ) {
//     // this.update = throttle(this.update, 12);
//     this.gTransform = element.getAttributeNode('transform');
//   }

//   bind() {
//     let rect = this.rect;
//     this.rectWidth = rect.getAttributeNode('width');
//     this.rectHeight = rect.getAttributeNode('height');
//     this.rectFill = rect.getAttributeNode('fill');
//     this.calc();
//   }

//   update(w: number, x: number, y: number, heightFactor: number, lean: number, lvl: number, maxlvl: number, branch: 'left' | 'right' | undefined, scale: number) {
//     this.w = w;
//     this.x = x;
//     this.y = y;
//     this.heightFactor = heightFactor;
//     this.lean = lean;
//     if (branch === 'left') {
//       this.left = true;
//       this.leftScale = scale;
//     }
//     if (branch === 'right') {
//       this.right = true;
//       this.rightScale = scale;
//     }
//     if (this.lvl !== lvl || this.maxlvl !== maxlvl) {
//       this.lvl = lvl;
//       this.maxlvl = maxlvl;
//       this.fill = memoizedViridis(this.lvl, this.maxlvl);
//     }
//     this.calc();
//     // enqueue(this);
//     // let now = performance.now();
//     // if (now - startTime > frameBudget) {
//     //   this.taskQueue.queueMicroTask(this);
//     // }
//     // this.calc();
//     // enqueue(this);
//   }

//   calc() {
//     let calc = memoizedCalc(this.w, this.heightFactor, this.lean);
//     let shouldRenderChild = this.lvl < this.maxlvl - 1;

//     this.nextRight = calc.nextRight;
//     this.nextLeft = calc.nextLeft;
//     this.A = calc.A;
//     this.B = calc.B;

//     // this.transform = memoizedTransform(this.x, this.y, this.w, calc.A, calc.B, this.left, this.right);

//     let renderLeft = shouldRenderChild && (calc.nextLeft >= 1);
//     if (renderLeft !== this.renderLeft) {
//       this.renderLeft = renderLeft;
//     }
//     let renderRight = shouldRenderChild && (calc.nextRight >= 1);
//     if (renderRight !== this.renderRight) {
//       this.renderRight = renderRight;
//     }
//     // this.updateEl();
//     if (this.leftNode) {
//       this.leftNodeChanged(this.leftNode);
//     }
//     if (this.rightNode) {
//       this.rightNodeChanged(this.rightNode);
//     }
//     enqueue(this);
//     // enqueue2(this);
//     // if (this.notqueued) {
//     //   this.notqueued = false;
//     //   this.taskQueue.queueMicroTask(this);
//     // }
//   }

//   getLP(): IPythagorasProps {
//     return {
//       w: this.nextLeft,
//       x: 0,
//       y: -this.nextLeft,
//       lvl: this.lvl + 1,
//       maxlvl: this.maxlvl,
//       heightFactor: this.heightFactor,
//       lean: this.lean,
//       branch: 'left'
//     };
//   }

//   getRP(): IPythagorasProps {
//     return {
//       w: this.nextRight,
//       x: this.w - this.nextRight,
//       y: -this.nextRight,
//       lvl: this.lvl + 1,
//       maxlvl: this.maxlvl,
//       heightFactor: this.heightFactor,
//       lean: this.lean,
//       branch: 'right'
//     };
//   }

//   notqueued: boolean = true;
//   call() {
//     // this.notqueued = true;
//     // this.calc();
//     this.updateEl();
//     // if (this.leftNode) {
//     //   this.leftNodeChanged(this.leftNode);
//     // }
//     // if (this.rightNode) {
//     //   this.rightNodeChanged(this.rightNode);
//     // }
//   }

//   lastW: number;
//   lastFill: string;
//   lastTransform: string;

//   // For transform
//   lastX: number;
//   lastY: number;
//   lastA: number;
//   lastB: number;

//   rectWidth: Attr;
//   rectHeight: Attr;
//   rectFill: Attr;
//   gTransform: Attr;
//   updateEl() {
//     var rect = this.rect;
//     if (rect) {
//       var w = this.w;
//       var fill = this.fill;
//       // if (w !== this.lastW) {
//       //   this.lastW = w;
//       //   var d = '' + w;

//       //   this.rectWidth.value = d;
//       //   this.rectHeight.value = d;
//       //   // rect.setAttribute('width', d);
//       //   // rect.setAttribute('height', d);
//       // }

//       if (fill !== this.lastFill) {
//         this.lastFill = fill;
//         this.rectFill.value = fill;
//         // rect.setAttribute('fill', fill);
//       }
//     }
//     var element = this.element;
//     var transform = memoizedTransform(this.x, this.y, this.w, this.A, this.B, this.left, this.right);
//     if (transform !== this.lastTransform) {
//       this.lastTransform = transform;
//       this.gTransform.value = transform;
//     }
//     // if (this.x !== this.lastX || this.y !== this.lastY || this.w !== this.lastW || this.A !== this.lastA || this.B !== this.lastB) {
//     //   this.lastX = this.x;
//     //   this.lastY = this.y;
//     //   this.lastW = this.w;
//     //   this.lastA = this.A;
//     //   this.lastB = this.B;
//     //   var element = this.element;
//     //   var transform = memoizedTransform(this.x, this.y, this.w, this.A, this.B, this.left, this.right);
//     //   // this.element.setAttribute('transform', `translate(${this.x} ${this.y}) ${
//     //   //   this.left
//     //   //     ? `rotate(${-this.A} 0 ${this.w})`
//     //   //     : this.right
//     //   //       ? `rotate(${this.B} ${this.w} ${this.w})`
//     //   //       : 'rotate(0)'
//     //   //   }`);
//     //   if (transform !== this.lastTransform) {
//     //     this.lastTransform = transform;
//     //     this.gTransform.value = transform;
//     //     // this.element.setAttribute('transform', this.transform);
//     //   }
//     // }
//   }

//   leftNodeChanged(node: Pythagoras) {
//     if (node) {
//       // node.update(this.getLP());
//       node.update(this.nextLeft, 0, -this.nextLeft, this.heightFactor, this.lean, this.lvl + 1, this.maxlvl, 'left', this.leftScale);
//       // if (this.nextLeft !== node.w
//       //   || -this.nextLeft !== node.y
//       //   || this.heightFactor !== node.heightFactor
//       //   || this.lean !== node.lean
//       // ) {
//       //   node.update(this.nextLeft, 0, -this.nextLeft, this.heightFactor, this.lean, this.lvl + 1, this.maxlvl, 'left');
//       // }
//     }
//   }

//   rightNodeChanged(node: Pythagoras) {
//     if (node) {
//       // node.update(this.getRP());
//       node.update(this.nextRight, this.w - this.nextRight, -this.nextRight, this.heightFactor, this.lean, this.lvl + 1, this.maxlvl, 'right', this.rightScale);
//       // if (this.nextRight !== node.w
//       //   || (this.w - this.nextRight) !== node.x
//       //   || -this.nextRight !== node.y
//       //   || this.heightFactor !== node.heightFactor
//       //   || this.lean !== node.lean
//       // ) {
//       //   node.update(this.nextRight, this.w - this.nextRight, -this.nextRight, this.heightFactor, this.lean, this.lvl + 1, this.maxlvl, 'right');
//       // }
//     }
//   }
// }

// @viewEngineHooks()
// export class RemoveSvg {
//   beforeCompile(fragment: DocumentFragment) {
//     let svg = fragment.querySelector('svg');
//     if (svg) {
//       let remove = svg.hasAttribute('remove');
//       if (remove) {
//         while (svg.childElementCount) {
//           if (svg.firstElementChild.nodeType === Node.ELEMENT_NODE) {
//             (svg.parentNode as Element).insertBefore(svg.firstElementChild, svg);
//           }
//         }
//         (svg.parentNode as Element).removeChild(svg);
//       }
//     }
//   }
// }

// interface ICalcResult {
//   nextRight: number;
//   nextLeft: number;
//   A: number;
//   B: number;
// }

// interface ICalcParams {
//   w: number;
//   heightFactor: number;
//   lean: number;
// }

// const memoizedViridis = (() => {
//   const memo: Record<string, any> = {};
//   const key = (lvl: number, maxlvl: number) => `${lvl}_${maxlvl}`;
//   return (lvl: number, maxlvl: number) => {
//     const memoKey = key(lvl, maxlvl);
//     if (memoKey in memo) {
//       return memo[memoKey];
//     } else {
//       return memo[memoKey] = vivid(lvl / maxlvl);
//     }
//   }
// })();

// const memoizedTransform = (() => {
//   const memo: Record<string, any> = {};
//   const key = (x: number, y: number, w: number, A: number, B: number, left: boolean, right: boolean) => {
//     return `${x}_${y}_${w}_${A}_${B}_${left}_${right}`;
//   };
//   return (x: number, y: number, w: number, A: number, B: number, left: boolean, right: boolean) => {
//     const memoKey = key(x, y, w, A, B, left, right);
//     if (memoKey in memo) {
//       return memo[memoKey];
//     }
//     return memo[memoKey] = `translate(${x} ${y}) ${left ? this.leftScale : this.rightScale} ${left
//       ? `rotate(${-A} 0 ${w})`
//       : right
//         ? `rotate(${B} ${w} ${w})`
//         : 'rotate(0)'
//       }`;;
//   }
// })();

// const memoizedCalc = (() => {
//   const memo: Record<string, ICalcResult> = {};
//   const rad2Deg = radians => radians * (180 / Math.PI);
//   const key = (w: number, heightFactor: number, lean: number) => `${w}_${heightFactor}_${lean}`;
//   return (w: number, heightFactor: number, lean: number) => {
//     const memoKey = key(w, heightFactor, lean);

//     if (memoKey in memo) {
//       return memo[memoKey];
//     } else {
//       // const { w, heightFactor, lean } = args;
//       const trigH = heightFactor * w;

//       const result = {
//         nextRight: Math.sqrt(trigH ** 2 + (w * (0.5 + lean)) ** 2),
//         nextLeft: Math.sqrt(trigH ** 2 + (w * (0.5 - lean)) ** 2),
//         A: rad2Deg(Math.atan(trigH / ((0.5 - lean) * w))),
//         B: rad2Deg(Math.atan(trigH / ((0.5 + lean) * w)))
//       };

//       memo[memoKey] = result;
//       return result
//     }
//   }
// })();

// const enqueue = (() => {
//   const queue: Pythagoras[] = [];              // the connect queue
//   const queued = {};             // tracks whether a binding with a particular id is in the queue
//   let nextId = 0;                // next available id that can be assigned to a binding for queue tracking purposes
//   const minimumImmediate = 100;  // number of bindings we should connect immediately before resorting to queueing
//   const frameBudget = 5;        // milliseconds allotted to each frame for flushing queue

//   let isFlushRequested = false;  // whether a flush of the connect queue has been requested
//   let immediate = 0;             // count of bindings that have been immediately connected

//   const doFlush = (function makeRequestFlushFromMutationObserver(fn) {
//     let toggle = 1;
//     let observer = new MutationObserver(fn);
//     let node = document.createTextNode('');
//     observer.observe(node, { characterData: true });
//     return function requestFlush() {
//       toggle = -toggle;
//       node.data = toggle.toString();
//     };
//   })(function flush() {
//     const animationFrameStart: number = performance.now();
//     const length = queue.length;
//     let i = 0;
//     while (i < length) {
//       const pythagoras = queue[i];
//       pythagoras.updateEl();
//       ++i;
//       // periodically check whether the frame budget has been hit.
//       // this ensures we don't call performance.now a lot and prevents starving the connect queue.
//       if (i % 100 === 0 && performance.now() - animationFrameStart > frameBudget) {
//         break;
//       }
//     }
//     queue.splice(0, i);

//     if (queue.length) {
//       doFlush();
//     } else {
//       isFlushRequested = false;
//       immediate = 0;
//     }
//   });

//   return function enqueue(pytha: Pythagoras) {
//     if (immediate < minimumImmediate) {
//       immediate++;
//       pytha.updateEl();
//     } else {
//       // enqueue the binding.
//       if (!queued[id]) {
//         queue.push(pytha);
//       }
//     }
//     if (!isFlushRequested) {
//       isFlushRequested = true;
//       doFlush();
//     }
//   }
// })();


// const enqueue2 = (() => {
//   const queue: Pythagoras[] = [];              // the connect queue
//   const queued = {};             // tracks whether a binding with a particular id is in the queue
//   let nextId = 0;                // next available id that can be assigned to a binding for queue tracking purposes
//   const minimumImmediate = 10;  // number of bindings we should connect immediately before resorting to queueing
//   const frameBudget = 8;        // milliseconds allotted to each frame for flushing queue

//   let isFlushRequested = false;  // whether a flush of the connect queue has been requested
//   let immediate = 0;             // count of bindings that have been immediately connected

//   const doFlush = function flush(animationFrameStart: number) {
//     const length = queue.length;
//     let i = 0;
//     while (i < length) {
//       const pythagoras = queue[i];
//       pythagoras.updateEl();
//       ++i;
//       // periodically check whether the frame budget has been hit.
//       // this ensures we don't call performance.now a lot and prevents starving the connect queue.
//       if (i % 100 === 0 && performance.now() - animationFrameStart > frameBudget) {
//         break;
//       }
//     }
//     queue.splice(0, i);

//     if (queue.length) {
//       requestAnimationFrame(doFlush);
//     } else {
//       isFlushRequested = false;
//       immediate = 0;
//     }
//   };

//   return function enqueue(pytha: Pythagoras) {
//     if (immediate < minimumImmediate) {
//       immediate++;
//       pytha.updateEl();
//     } else {
//       queue.push(pytha);
//     }
//     if (!isFlushRequested) {
//       isFlushRequested = true;
//       requestAnimationFrame(doFlush);
//     }
//   }
// })();
