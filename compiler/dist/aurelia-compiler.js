'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var ts = require('typescript');
var aureliaPath = require('aurelia-path');

class Token {
    constructor(index, text) {
        this.index = index;
        this.text = text;
    }
    withOp(op) {
        this.opKey = op;
        return this;
    }
    withGetterSetter(key) {
        this.key = key;
        return this;
    }
    withValue(value) {
        this.value = value;
        return this;
    }
    toString() {
        return `Token(${this.text})`;
    }
}
class Lexer {
    lex(text) {
        let scanner = new Scanner(text);
        let tokens = [];
        let token = scanner.scanToken();
        while (token) {
            tokens.push(token);
            token = scanner.scanToken();
        }
        return tokens;
    }
}
class Scanner {
    constructor(input) {
        this.input = input;
        this.length = input.length;
        this.peek = 0;
        this.index = -1;
        this.advance();
    }
    scanToken() {
        while (this.peek <= $SPACE) {
            if (++this.index >= this.length) {
                this.peek = $EOF;
                return null;
            }
            this.peek = this.input.charCodeAt(this.index);
        }
        if (isIdentifierStart(this.peek)) {
            return this.scanIdentifier();
        }
        if (isDigit(this.peek)) {
            return this.scanNumber(this.index);
        }
        let start = this.index;
        switch (this.peek) {
            case $PERIOD:
                this.advance();
                return isDigit(this.peek) ? this.scanNumber(start) : new Token(start, '.');
            case $LPAREN:
            case $RPAREN:
            case $LBRACE:
            case $RBRACE:
            case $LBRACKET:
            case $RBRACKET:
            case $COMMA:
            case $COLON:
            case $SEMICOLON:
                return this.scanCharacter(start, String.fromCharCode(this.peek));
            case $SQ:
            case $DQ:
                return this.scanString();
            case $PLUS:
            case $MINUS:
            case $STAR:
            case $SLASH:
            case $PERCENT:
            case $CARET:
            case $QUESTION:
                return this.scanOperator(start, String.fromCharCode(this.peek));
            case $LT:
            case $GT:
            case $BANG:
            case $EQ:
                return this.scanComplexOperator(start, $EQ, String.fromCharCode(this.peek), '=');
            case $AMPERSAND:
                return this.scanComplexOperator(start, $AMPERSAND, '&', '&');
            case $BAR:
                return this.scanComplexOperator(start, $BAR, '|', '|');
            case $NBSP:
                while (isWhitespace(this.peek)) {
                    this.advance();
                }
                return this.scanToken();
        }
        let character = String.fromCharCode(this.peek);
        this.error(`Unexpected character [${character}]`);
        return null;
    }
    scanCharacter(start, text) {
        assert(this.peek === text.charCodeAt(0));
        this.advance();
        return new Token(start, text);
    }
    scanOperator(start, text) {
        assert(this.peek === text.charCodeAt(0));
        assert(OPERATORS[text] === 1);
        this.advance();
        return new Token(start, text).withOp(text);
    }
    scanComplexOperator(start, code, one, two) {
        assert(this.peek === one.charCodeAt(0));
        this.advance();
        let text = one;
        if (this.peek === code) {
            this.advance();
            text += two;
        }
        if (this.peek === code) {
            this.advance();
            text += two;
        }
        assert(OPERATORS[text] === 1);
        return new Token(start, text).withOp(text);
    }
    scanIdentifier() {
        assert(isIdentifierStart(this.peek));
        let start = this.index;
        this.advance();
        while (isIdentifierPart(this.peek)) {
            this.advance();
        }
        let text = this.input.substring(start, this.index);
        let result = new Token(start, text);
        if (OPERATORS[text] === 1) {
            result.withOp(text);
        }
        else {
            result.withGetterSetter(text);
        }
        return result;
    }
    scanNumber(start) {
        assert(isDigit(this.peek));
        let simple = (this.index === start);
        this.advance();
        while (true) {
            if (!isDigit(this.peek)) {
                if (this.peek === $PERIOD) {
                    simple = false;
                }
                else if (isExponentStart(this.peek)) {
                    this.advance();
                    if (isExponentSign(this.peek)) {
                        this.advance();
                    }
                    if (!isDigit(this.peek)) {
                        this.error('Invalid exponent', -1);
                    }
                    simple = false;
                }
                else {
                    break;
                }
            }
            this.advance();
        }
        let text = this.input.substring(start, this.index);
        let value = simple ? parseInt(text, 10) : parseFloat(text);
        return new Token(start, text).withValue(value);
    }
    scanString() {
        assert(this.peek === $SQ || this.peek === $DQ);
        let start = this.index;
        let quote = this.peek;
        this.advance();
        let buffer;
        let marker = this.index;
        while (this.peek !== quote) {
            if (this.peek === $BACKSLASH) {
                if (!buffer) {
                    buffer = [];
                }
                buffer.push(this.input.substring(marker, this.index));
                this.advance();
                let unescaped;
                if (this.peek === $u) {
                    let hex = this.input.substring(this.index + 1, this.index + 5);
                    if (!/[A-Z0-9]{4}/.test(hex)) {
                        this.error(`Invalid unicode escape [\\u${hex}]`);
                    }
                    unescaped = parseInt(hex, 16);
                    for (let i = 0; i < 5; ++i) {
                        this.advance();
                    }
                }
                else {
                    unescaped = unescape(this.peek);
                    this.advance();
                }
                buffer.push(String.fromCharCode(unescaped));
                marker = this.index;
            }
            else if (this.peek === $EOF) {
                this.error('Unterminated quote');
            }
            else {
                this.advance();
            }
        }
        let last = this.input.substring(marker, this.index);
        this.advance();
        let text = this.input.substring(start, this.index);
        let unescaped = last;
        if (buffer !== null && buffer !== undefined) {
            buffer.push(last);
            unescaped = buffer.join('');
        }
        return new Token(start, text).withValue(unescaped);
    }
    advance() {
        if (++this.index >= this.length) {
            this.peek = $EOF;
        }
        else {
            this.peek = this.input.charCodeAt(this.index);
        }
    }
    error(message, offset = 0) {
        let position = this.index + offset;
        throw new Error(`Lexer Error: ${message} at column ${position} in expression [${this.input}]`);
    }
}
const OPERATORS = {
    'undefined': 1,
    'null': 1,
    'true': 1,
    'false': 1,
    '+': 1,
    '-': 1,
    '*': 1,
    '/': 1,
    '%': 1,
    '^': 1,
    '=': 1,
    '==': 1,
    '===': 1,
    '!=': 1,
    '!==': 1,
    '<': 1,
    '>': 1,
    '<=': 1,
    '>=': 1,
    '&&': 1,
    '||': 1,
    '&': 1,
    '|': 1,
    '!': 1,
    '?': 1
};
const $EOF = 0;
const $TAB = 9;
const $LF = 10;
const $VTAB = 11;
const $FF = 12;
const $CR = 13;
const $SPACE = 32;
const $BANG = 33;
const $DQ = 34;
const $$ = 36;
const $PERCENT = 37;
const $AMPERSAND = 38;
const $SQ = 39;
const $LPAREN = 40;
const $RPAREN = 41;
const $STAR = 42;
const $PLUS = 43;
const $COMMA = 44;
const $MINUS = 45;
const $PERIOD = 46;
const $SLASH = 47;
const $COLON = 58;
const $SEMICOLON = 59;
const $LT = 60;
const $EQ = 61;
const $GT = 62;
const $QUESTION = 63;
const $0 = 48;
const $9 = 57;
const $A = 65;
const $E = 69;
const $Z = 90;
const $LBRACKET = 91;
const $BACKSLASH = 92;
const $RBRACKET = 93;
const $CARET = 94;
const $_ = 95;
const $a = 97;
const $e = 101;
const $f = 102;
const $n = 110;
const $r = 114;
const $t = 116;
const $u = 117;
const $v = 118;
const $z = 122;
const $LBRACE = 123;
const $BAR = 124;
const $RBRACE = 125;
const $NBSP = 160;
function isWhitespace(code) {
    return (code >= $TAB && code <= $SPACE) || (code === $NBSP);
}
function isIdentifierStart(code) {
    return ($a <= code && code <= $z)
        || ($A <= code && code <= $Z)
        || (code === $_)
        || (code === $$);
}
function isIdentifierPart(code) {
    return ($a <= code && code <= $z)
        || ($A <= code && code <= $Z)
        || ($0 <= code && code <= $9)
        || (code === $_)
        || (code === $$);
}
function isDigit(code) {
    return ($0 <= code && code <= $9);
}
function isExponentStart(code) {
    return (code === $e || code === $E);
}
function isExponentSign(code) {
    return (code === $MINUS || code === $PLUS);
}
function unescape(code) {
    switch (code) {
        case $n: return $LF;
        case $f: return $FF;
        case $r: return $CR;
        case $t: return $TAB;
        case $v: return $VTAB;
        default: return code;
    }
}
function assert(condition, message) {
    if (!condition) {
        throw message || 'Assertion failed';
    }
}

var AstKind;
(function (AstKind) {
    AstKind[AstKind["Base"] = 1] = "Base";
    AstKind[AstKind["Chain"] = 2] = "Chain";
    AstKind[AstKind["ValueConverter"] = 3] = "ValueConverter";
    AstKind[AstKind["BindingBehavior"] = 4] = "BindingBehavior";
    AstKind[AstKind["Assign"] = 5] = "Assign";
    AstKind[AstKind["Conditional"] = 6] = "Conditional";
    AstKind[AstKind["AccessThis"] = 7] = "AccessThis";
    AstKind[AstKind["AccessScope"] = 8] = "AccessScope";
    AstKind[AstKind["AccessMember"] = 9] = "AccessMember";
    AstKind[AstKind["AccessKeyed"] = 10] = "AccessKeyed";
    AstKind[AstKind["CallScope"] = 11] = "CallScope";
    AstKind[AstKind["CallFunction"] = 12] = "CallFunction";
    AstKind[AstKind["CallMember"] = 13] = "CallMember";
    AstKind[AstKind["PrefixNot"] = 14] = "PrefixNot";
    AstKind[AstKind["Binary"] = 15] = "Binary";
    AstKind[AstKind["LiteralPrimitive"] = 16] = "LiteralPrimitive";
    AstKind[AstKind["LiteralArray"] = 17] = "LiteralArray";
    AstKind[AstKind["LiteralObject"] = 18] = "LiteralObject";
    AstKind[AstKind["LiteralString"] = 19] = "LiteralString";
    AstKind[AstKind["TemplateLiteral"] = 20] = "TemplateLiteral";
})(AstKind || (AstKind = {}));
class Expression {
    toJSON() {
        return this.dehydrate();
    }
    toString() {
        return JSON.stringify(this);
    }
}
class Chain extends Expression {
    constructor(expressions) {
        super();
        this.expressions = expressions;
    }
    dehydrate() {
        return [AstKind.Chain, this.expressions.map(e => e.dehydrate())];
    }
    get observedProperties() {
        return this.expressions.reduce((props, e) => props.concat(e.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Chain'), undefined, [
            ...this.expressions.map(e => e.code)
        ]);
    }
}
class BindingBehavior extends Expression {
    constructor(expression, name, args) {
        super();
        this.expression = expression;
        this.name = name;
        this.args = args;
    }
    dehydrate() {
        return [AstKind.BindingBehavior, this.name, this.args.map(a => a.dehydrate())];
    }
    get observedProperties() {
        return this.args.reduce((props, a) => props.concat(a.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('BindingBehavior'), undefined, [
            ts.createLiteral(this.name),
            ...this.args.map(a => a.code)
        ]);
    }
}
class ValueConverter extends Expression {
    constructor(expression, name, args) {
        super();
        this.expression = expression;
        this.name = name;
        this.args = args;
    }
    dehydrate() {
        return [
            AstKind.ValueConverter,
            this.expression.dehydrate(),
            this.name,
            this.args.map(a => a.dehydrate())
        ];
    }
    get observedProperties() {
        return this.args.reduce((props, a) => props.concat(a.observedProperties), this.expression.observedProperties);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('ValueConverter'), undefined, [
            ts.createLiteral('this.name'),
            ...this.args.map(a => a.code)
        ]);
    }
}
class Assign extends Expression {
    constructor(target, value) {
        super();
        this.target = target;
        this.value = value;
    }
    dehydrate() {
        return [
            AstKind.Assign,
            this.target.dehydrate(),
            this.value.dehydrate()
        ];
    }
    get observedProperties() {
        return [...this.value.observedProperties];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Assign'), undefined, [
            this.target.code,
            this.value.code
        ]);
    }
}
class Conditional extends Expression {
    constructor(condition, yes, no) {
        super();
        this.condition = condition;
        this.yes = yes;
        this.no = no;
    }
    dehydrate() {
        return [
            AstKind.Conditional,
            this.condition.dehydrate(),
            this.yes.dehydrate(),
            this.no.dehydrate()
        ];
    }
    get observedProperties() {
        return [
            ...this.condition.observedProperties,
            ...this.yes.observedProperties,
            ...this.no.observedProperties
        ];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Conditional'), undefined, [
            this.condition.code,
            this.yes.code,
            this.no.code
        ]);
    }
}
class AccessThis extends Expression {
    constructor(ancestor = 0) {
        super();
        this.ancestor = ancestor;
    }
    dehydrate() {
        return [
            AstKind.AccessThis,
            this.ancestor
        ];
    }
    get observedProperties() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('AccessThis'), undefined, [
            ts.createLiteral(this.ancestor)
        ]);
    }
}
class AccessScope extends Expression {
    constructor(name, ancestor = 0) {
        super();
        this.name = name;
        this.ancestor = ancestor;
    }
    dehydrate() {
        return [
            AstKind.AccessScope,
            this.name,
            this.ancestor
        ];
    }
    get observedProperties() {
        return this.ancestor === 0 ? [this.name] : [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('AccessScope'), undefined, [
            ts.createLiteral(this.name),
            ts.createLiteral(this.ancestor)
        ]);
    }
}
class AccessMember extends Expression {
    constructor(object, name) {
        super();
        this.object = object;
        this.name = name;
    }
    dehydrate() {
        return [
            AstKind.AccessMember,
            this.object.dehydrate(),
            this.name
        ];
    }
    get observedProperties() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('AccessMember'), undefined, [
            this.object.code,
            ts.createLiteral(this.name)
        ]);
    }
}
class AccessKeyed extends Expression {
    constructor(object, key) {
        super();
        this.object = object;
        this.key = key;
    }
    dehydrate() {
        return [
            AstKind.AccessKeyed,
            this.object.dehydrate(),
            this.key
        ];
    }
    get observedProperties() {
        if (this.object instanceof AccessScope) {
            return [this.key.toString(), ...this.object.observedProperties];
        }
        else {
            return [];
        }
    }
    get code() {
        return ts.createNew(ts.createIdentifier('AccessKeyed'), undefined, [
            this.object.code,
            !(this.key instanceof Object) ? ts.createLiteral(this.key) : undefined
        ].filter(Boolean));
    }
}
class CallScope extends Expression {
    constructor(name, args, ancestor = 0) {
        super();
        this.name = name;
        this.args = args;
        this.ancestor = ancestor;
    }
    dehydrate() {
        return [
            AstKind.CallScope,
            this.name,
            this.args.map(a => a.dehydrate()),
            this.ancestor
        ];
    }
    get observedProperties() {
        return this.args.reduce((props, a) => props.concat(a.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('CallScope'), undefined, [
            ts.createLiteral(this.name),
            ...this.args.map(a => a.code),
            ts.createLiteral(this.ancestor)
        ]);
    }
}
class CallMember extends Expression {
    constructor(object, name, args) {
        super();
        this.object = object;
        this.name = name;
        this.args = args;
    }
    dehydrate() {
        return [
            AstKind.CallMember,
            this.object.dehydrate(),
            this.name,
            this.args.map(a => a.dehydrate())
        ];
    }
    get observedProperties() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('CallMember'), undefined, [
            this.object.code,
            ts.createLiteral(this.name),
            ...this.args.map(a => a.code)
        ]);
    }
}
class CallFunction extends Expression {
    constructor(func, args) {
        super();
        this.func = func;
        this.args = args;
    }
    dehydrate() {
        return [
            AstKind.CallFunction,
            this.func.dehydrate(),
            this.args.map(a => a.dehydrate())
        ];
    }
    get observedProperties() {
        return this.args.reduce((props, a) => props.concat(a.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('CallFunction'), undefined, [
            this.func.code,
            ...this.args.map(a => a.code)
        ]);
    }
}
class Binary extends Expression {
    constructor(operation, left, right) {
        super();
        this.operation = operation;
        this.left = left;
        this.right = right;
    }
    dehydrate() {
        return [
            AstKind.Binary,
            this.operation,
            this.left.dehydrate(),
            this.right.dehydrate()
        ];
    }
    get observedProperties() {
        return [...this.left.observedProperties, ...this.right.observedProperties];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Binary'), undefined, [
            ts.createLiteral(this.operation),
            this.left.code,
            this.right.code
        ]);
    }
}
class PrefixNot extends Expression {
    constructor(expression) {
        super();
        this.expression = expression;
    }
    dehydrate() {
        return [
            AstKind.PrefixNot,
            this.expression.dehydrate()
        ];
    }
    get observedProperties() {
        return this.expression.observedProperties;
    }
    get code() {
        return ts.createNew(ts.createIdentifier('PrefixNot'), undefined, [
            this.expression.code
        ]);
    }
}
class LiteralPrimitive extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }
    dehydrate() {
        return [
            AstKind.LiteralPrimitive,
            this.value
        ];
    }
    get observedProperties() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('LiteralPrimitive'), undefined, [
            this.value === null
                ? ts.createNull()
                : this.value === undefined
                    ? ts.createIdentifier('undefined')
                    : ts.createLiteral(this.value)
        ]);
    }
}
class LiteralString extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }
    dehydrate() {
        return [
            AstKind.LiteralString,
            this.value
        ];
    }
    get observedProperties() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('LiteralString'), undefined, [
            ts.createLiteral(this.value)
        ]);
    }
}
class TemplateLiteral extends Expression {
    constructor(parts) {
        super();
        this.parts = parts;
    }
    dehydrate() {
        return [
            AstKind.TemplateLiteral,
            this.parts.map(p => p.dehydrate())
        ];
    }
    get observedProperties() {
        return this.parts.reduce((props, v) => props.concat(v.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('TemplateLiteral'), undefined, [
            ...this.parts.map(p => p.code)
        ]);
    }
}
class LiteralArray extends Expression {
    constructor(elements) {
        super();
        this.elements = elements;
    }
    dehydrate() {
        return [
            AstKind.LiteralArray,
            this.elements.map(e => e.dehydrate())
        ];
    }
    get observedProperties() {
        return this.elements.reduce((props, e) => props.concat(e.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('LiteralArray'), undefined, [
            ...this.elements.map(e => e.code)
        ]);
    }
}
class LiteralObject extends Expression {
    constructor(keys, values) {
        super();
        this.keys = keys;
        this.values = values;
    }
    dehydrate() {
        return [
            AstKind.LiteralObject,
            this.keys,
            this.values.map(v => v.dehydrate())
        ];
    }
    get observedProperties() {
        return this.values.reduce((props, v) => props.concat(v.observedProperties), []);
    }
    get code() {
        return ts.createNew(ts.createIdentifier('LiteralObject'), undefined, [
            ...this.keys.map(k => ts.createLiteral(k)),
            ...this.values.map(v => v.code)
        ]);
    }
}


var AST = Object.freeze({
	get AstKind () { return AstKind; },
	Expression: Expression,
	Chain: Chain,
	BindingBehavior: BindingBehavior,
	ValueConverter: ValueConverter,
	Assign: Assign,
	Conditional: Conditional,
	AccessThis: AccessThis,
	AccessScope: AccessScope,
	AccessMember: AccessMember,
	AccessKeyed: AccessKeyed,
	CallScope: CallScope,
	CallMember: CallMember,
	CallFunction: CallFunction,
	Binary: Binary,
	PrefixNot: PrefixNot,
	LiteralPrimitive: LiteralPrimitive,
	LiteralString: LiteralString,
	TemplateLiteral: TemplateLiteral,
	LiteralArray: LiteralArray,
	LiteralObject: LiteralObject
});

let AstNames = Object.getOwnPropertyNames(AST).filter(ast => ast !== 'Expression');
let EOF = new Token(-1, '');
class Parser {
    constructor() {
        this.cache = {};
        this.lexer = new Lexer();
    }
    static addAst(expression, ast) {
        return this.astRegistry[expression]
            || (this.astRegistry[expression] = {
                id: this.astId++,
                ast
            });
    }
    static emitAst() {
        let file = ts.createSourceFile('src/asts.js', [
            `/* Aurelia Compiler - auto generated file */`,
            `import {\n${AstNames.join(', \n')}\n} from './framework/binding/ast';`,
            `export var getAst = id => Asts[id];`
        ].join('\n'), ts.ScriptTarget.Latest, true);
        return ts.updateSourceFileNode(file, [
            ...file.statements,
            ts.createVariableStatement(undefined, [
                ts.createVariableDeclaration('Asts', undefined, ts.createObjectLiteral([
                    ...Object.keys(this.astRegistry)
                        .map(exp => {
                        let record = this.astRegistry[exp];
                        return ts.createPropertyAssignment(ts.createLiteral(record.id), record.ast.code);
                    })
                ], true))
            ])
        ]);
    }
    static generateAst() {
        return [
            `/* Aurelia Compiler - auto generated file */`,
            `import {\n  ${AstNames.join(', \n')}\n} from './framework/binding/ast';\n`,
            `export var getAst = id => Asts[id];\n`,
            ts.createPrinter().printNode(ts.EmitHint.Unspecified, ts.createVariableStatement(undefined, [
                ts.createVariableDeclaration('Asts', undefined, ts.createObjectLiteral([
                    ...Object.keys(this.astRegistry)
                        .map(exp => {
                        let record = this.astRegistry[exp];
                        return ts.createPropertyAssignment(ts.createLiteral(record.id), record.ast.code);
                    })
                ], true))
            ]), ts.createSourceFile('noname', '', ts.ScriptTarget.Latest)),
            ''
        ].join('\n');
    }
    parse(input) {
        input = input || '';
        return this.cache[input]
            || (this.cache[input] = new ParserImplementation(this.lexer, input).parseChain());
    }
    getOrCreateAstRecord(input) {
        return Parser.astRegistry[input] || (Parser.addAst(input, this.parse(input)));
    }
}
Parser.astId = 1;
Parser.astRegistry = {};
class ParserImplementation {
    constructor(lexer, input) {
        this.lexer = lexer;
        this.input = input;
        this.index = 0;
        this.input = input;
        this.tokens = lexer.lex(input);
    }
    get peek() {
        return (this.index < this.tokens.length) ? this.tokens[this.index] : EOF;
    }
    parseChain() {
        let isChain = false;
        let expressions = [];
        while (this.optional(';')) {
            isChain = true;
        }
        while (this.index < this.tokens.length) {
            if (this.peek.text === ')' || this.peek.text === '}' || this.peek.text === ']') {
                this.error(`Unconsumed token ${this.peek.text}`);
            }
            let expr = this.parseBindingBehavior();
            expressions.push(expr);
            while (this.optional(';')) {
                isChain = true;
            }
            if (isChain) {
                this.error('Multiple expressions are not allowed.');
            }
        }
        return (expressions.length === 1) ? expressions[0] : new Chain(expressions);
    }
    parseBindingBehavior() {
        let result = this.parseValueConverter();
        while (this.optional('&')) {
            let name = this.peek.text;
            let args = [];
            this.advance();
            while (this.optional(':')) {
                args.push(this.parseExpression());
            }
            result = new BindingBehavior(result, name, args);
        }
        return result;
    }
    parseValueConverter() {
        let result = this.parseExpression();
        while (this.optional('|')) {
            let name = this.peek.text;
            let args = [];
            this.advance();
            while (this.optional(':')) {
                args.push(this.parseExpression());
            }
            result = new ValueConverter(result, name, args);
        }
        return result;
    }
    parseExpression() {
        let start = this.peek.index;
        let result = this.parseConditional();
        while (this.peek.text === '=') {
            if (!result.isAssignable) {
                let end = (this.index < this.tokens.length) ? this.peek.index : this.input.length;
                let expression = this.input.substring(start, end);
                this.error(`Expression ${expression} is not assignable`);
            }
            this.expect('=');
            result = new Assign(result, this.parseConditional());
        }
        return result;
    }
    parseConditional() {
        let start = this.peek.index;
        let result = this.parseLogicalOr();
        if (this.optional('?')) {
            let yes = this.parseExpression();
            if (!this.optional(':')) {
                let end = (this.index < this.tokens.length) ? this.peek.index : this.input.length;
                let expression = this.input.substring(start, end);
                this.error(`Conditional expression ${expression} requires all 3 expressions`);
            }
            let no = this.parseExpression();
            result = new Conditional(result, yes, no);
        }
        return result;
    }
    parseLogicalOr() {
        let result = this.parseLogicalAnd();
        while (this.optional('||')) {
            result = new Binary('||', result, this.parseLogicalAnd());
        }
        return result;
    }
    parseLogicalAnd() {
        let result = this.parseEquality();
        while (this.optional('&&')) {
            result = new Binary('&&', result, this.parseEquality());
        }
        return result;
    }
    parseEquality() {
        let result = this.parseRelational();
        while (true) {
            if (this.optional('==')) {
                result = new Binary('==', result, this.parseRelational());
            }
            else if (this.optional('!=')) {
                result = new Binary('!=', result, this.parseRelational());
            }
            else if (this.optional('===')) {
                result = new Binary('===', result, this.parseRelational());
            }
            else if (this.optional('!==')) {
                result = new Binary('!==', result, this.parseRelational());
            }
            else {
                return result;
            }
        }
    }
    parseRelational() {
        let result = this.parseAdditive();
        while (true) {
            if (this.optional('<')) {
                result = new Binary('<', result, this.parseAdditive());
            }
            else if (this.optional('>')) {
                result = new Binary('>', result, this.parseAdditive());
            }
            else if (this.optional('<=')) {
                result = new Binary('<=', result, this.parseAdditive());
            }
            else if (this.optional('>=')) {
                result = new Binary('>=', result, this.parseAdditive());
            }
            else {
                return result;
            }
        }
    }
    parseAdditive() {
        let result = this.parseMultiplicative();
        while (true) {
            if (this.optional('+')) {
                result = new Binary('+', result, this.parseMultiplicative());
            }
            else if (this.optional('-')) {
                result = new Binary('-', result, this.parseMultiplicative());
            }
            else {
                return result;
            }
        }
    }
    parseMultiplicative() {
        let result = this.parsePrefix();
        while (true) {
            if (this.optional('*')) {
                result = new Binary('*', result, this.parsePrefix());
            }
            else if (this.optional('%')) {
                result = new Binary('%', result, this.parsePrefix());
            }
            else if (this.optional('/')) {
                result = new Binary('/', result, this.parsePrefix());
            }
            else {
                return result;
            }
        }
    }
    parsePrefix() {
        if (this.optional('+')) {
            return this.parsePrefix();
        }
        else if (this.optional('-')) {
            return new Binary('-', new LiteralPrimitive(0), this.parsePrefix());
        }
        else if (this.optional('!')) {
            return new PrefixNot(this.parsePrefix());
        }
        return this.parseAccessOrCallMember();
    }
    parseAccessOrCallMember() {
        let result = this.parsePrimary();
        while (true) {
            if (this.optional('.')) {
                let name = this.peek.text;
                this.advance();
                if (this.optional('(')) {
                    let args = this.parseExpressionList(')');
                    this.expect(')');
                    if (result instanceof AccessThis) {
                        result = new CallScope(name, args, result.ancestor);
                    }
                    else {
                        result = new CallMember(result, name, args);
                    }
                }
                else {
                    if (result instanceof AccessThis) {
                        result = new AccessScope(name, result.ancestor);
                    }
                    else {
                        result = new AccessMember(result, name);
                    }
                }
            }
            else if (this.optional('[')) {
                let key = this.parseExpression();
                this.expect(']');
                result = new AccessKeyed(result, key);
            }
            else if (this.optional('(')) {
                let args = this.parseExpressionList(')');
                this.expect(')');
                result = new CallFunction(result, args);
            }
            else {
                return result;
            }
        }
    }
    parsePrimary() {
        if (this.optional('(')) {
            let result = this.parseExpression();
            this.expect(')');
            return result;
        }
        else if (this.optional('null')) {
            return new LiteralPrimitive(null);
        }
        else if (this.optional('undefined')) {
            return new LiteralPrimitive(undefined);
        }
        else if (this.optional('true')) {
            return new LiteralPrimitive(true);
        }
        else if (this.optional('false')) {
            return new LiteralPrimitive(false);
        }
        else if (this.optional('[')) {
            let elements = this.parseExpressionList(']');
            this.expect(']');
            return new LiteralArray(elements);
        }
        else if (this.peek.text === '{') {
            return this.parseObject();
        }
        else if (this.peek.key !== null && this.peek.key !== undefined) {
            return this.parseAccessOrCallScope();
        }
        else if (this.peek.value !== null && this.peek.value !== undefined) {
            let value = this.peek.value;
            this.advance();
            return value instanceof String || typeof value === 'string' ? new LiteralString('' + value) : new LiteralPrimitive(value);
        }
        else if (this.index >= this.tokens.length) {
            throw new Error(`Unexpected end of expression: ${this.input}`);
        }
        else {
            return this.error(`Unexpected token ${this.peek.text}`);
        }
    }
    parseAccessOrCallScope() {
        let name = this.peek.key;
        this.advance();
        if (name === '$this') {
            return new AccessThis(0);
        }
        let ancestor = 0;
        while (name === '$parent') {
            ancestor++;
            if (this.optional('.')) {
                name = this.peek.key;
                this.advance();
            }
            else if (this.peek === EOF
                || this.peek.text === '('
                || this.peek.text === ')'
                || this.peek.text === '['
                || this.peek.text === '}'
                || this.peek.text === ','
                || this.peek.text === '|'
                || this.peek.text === '&') {
                return new AccessThis(ancestor);
            }
            else {
                this.error(`Unexpected token ${this.peek.text}`);
            }
        }
        if (this.optional('(')) {
            let args = this.parseExpressionList(')');
            this.expect(')');
            return new CallScope(name, args, ancestor);
        }
        return new AccessScope(name, ancestor);
    }
    parseObject() {
        let keys = [];
        let values = [];
        this.expect('{');
        if (this.peek.text !== '}') {
            do {
                let peek = this.peek;
                let value = peek.value;
                keys.push(typeof value === 'string' ? value : peek.text);
                this.advance();
                if (peek.key && (this.peek.text === ',' || this.peek.text === '}')) {
                    --this.index;
                    values.push(this.parseAccessOrCallScope());
                }
                else {
                    this.expect(':');
                    values.push(this.parseExpression());
                }
            } while (this.optional(','));
        }
        this.expect('}');
        return new LiteralObject(keys, values);
    }
    parseExpressionList(terminator) {
        let result = [];
        if (this.peek.text !== terminator) {
            do {
                result.push(this.parseExpression());
            } while (this.optional(','));
        }
        return result;
    }
    optional(text) {
        if (this.peek.text === text) {
            this.advance();
            return true;
        }
        return false;
    }
    expect(text) {
        if (this.peek.text === text) {
            this.advance();
        }
        else {
            this.error(`Missing expected ${text}`);
        }
    }
    advance() {
        this.index++;
    }
    error(message) {
        let location = (this.index < this.tokens.length)
            ? `at column ${this.tokens[this.index].index + 1} in`
            : 'at the end of the expression';
        throw new Error(`Parser Error: ${message} ${location} [${this.input}]`);
    }
}

var bindingType;
(function (bindingType) {
    bindingType[bindingType["binding"] = 1] = "binding";
    bindingType[bindingType["listener"] = 2] = "listener";
    bindingType[bindingType["ref"] = 3] = "ref";
    bindingType[bindingType["text"] = 4] = "text";
})(bindingType || (bindingType = {}));
const ELEMENT_REF_KEY = 'element';
var resourceKind;
(function (resourceKind) {
    resourceKind[resourceKind["element"] = 0] = "element";
    resourceKind[resourceKind["attribute"] = 1] = "attribute";
    resourceKind[resourceKind["valueConverter"] = 2] = "valueConverter";
    resourceKind[resourceKind["bindingBehavior"] = 3] = "bindingBehavior";
})(resourceKind || (resourceKind = {}));

require('basichtml').init();
const DOM = new class {
    parseHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        return div;
    }
    createTemplateFromMarkup(markup) {
        let parser = document.createElement('div');
        parser.innerHTML = markup;
        let temp = parser.firstElementChild;
        if (!temp || temp.nodeName !== 'TEMPLATE') {
            throw new Error('Template markup must be wrapped in a <template> element e.g. <template> <!-- markup here --> </template>');
        }
        return temp;
    }
};

var bindingMode;
(function (bindingMode) {
    bindingMode[bindingMode["oneTime"] = 0] = "oneTime";
    bindingMode[bindingMode["toView"] = 1] = "toView";
    bindingMode[bindingMode["oneWay"] = 1] = "oneWay";
    bindingMode[bindingMode["fromView"] = 3] = "fromView";
    bindingMode[bindingMode["twoWay"] = 2] = "twoWay";
})(bindingMode || (bindingMode = {}));
var delegationStrategy;
(function (delegationStrategy) {
    delegationStrategy[delegationStrategy["none"] = 0] = "none";
    delegationStrategy[delegationStrategy["capturing"] = 1] = "capturing";
    delegationStrategy[delegationStrategy["bubbling"] = 2] = "bubbling";
})(delegationStrategy || (delegationStrategy = {}));
class AbstractBinding {
    constructor() {
        this.textAccessor = 'textContent';
    }
    static resolveBindingMode(mode) {
        return ts.createLiteral(mode);
    }
}
AbstractBinding.targetsAccessor = 'targets';
AbstractBinding.getAstFn = 'getAst';
class PropertyBinding extends AbstractBinding {
    constructor(astRecord, targetIndex, targetProperty, mode = bindingMode.oneWay, forBehavior, behaviorIndex) {
        super();
        this.astRecord = astRecord;
        this.targetIndex = targetIndex;
        this.targetProperty = targetProperty;
        this.mode = mode;
        this.forBehavior = forBehavior;
        this.behaviorIndex = behaviorIndex;
    }
    get dehydrated() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Binding'), undefined, [
            ts.createCall(ts.createIdentifier(AbstractBinding.getAstFn), undefined, [
                ts.createLiteral(this.astRecord.id)
            ]),
            this.forBehavior
                ? ts.createPropertyAccess(ts.createThis(), `$b${this.behaviorIndex}`)
                : ts.createElementAccess(ts.createIdentifier(AbstractBinding.targetsAccessor), ts.createNumericLiteral(this.targetIndex.toString())),
            ts.createLiteral(this.targetProperty),
            AbstractBinding.resolveBindingMode(this.mode),
            ts.createIdentifier('lookupFunctions')
        ]);
    }
    get observedProperties() {
        return this.astRecord.ast.observedProperties;
    }
}
class ListenerBinding extends AbstractBinding {
    constructor(astRecord, targetIndex, targetEvent, delegationStrategy, preventDefault = true) {
        super();
        this.astRecord = astRecord;
        this.targetIndex = targetIndex;
        this.targetEvent = targetEvent;
        this.delegationStrategy = delegationStrategy;
        this.preventDefault = preventDefault;
    }
    get dehydrated() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('Listener'), undefined, [
            ts.createLiteral(this.targetEvent),
            ts.createLiteral(this.delegationStrategy),
            ts.createCall(ts.createIdentifier(AbstractBinding.getAstFn), undefined, [
                ts.createLiteral(this.astRecord.id)
            ]),
            ts.createElementAccess(ts.createIdentifier(AbstractBinding.targetsAccessor), ts.createNumericLiteral(this.targetIndex.toString())),
            ts.createLiteral(this.preventDefault),
            ts.createIdentifier('lookupFunctions')
        ]);
    }
    get observedProperties() {
        return this.astRecord.ast.observedProperties;
    }
}
class RefBinding extends AbstractBinding {
    constructor(astRecord, targetIndex, targetProperty) {
        super();
        this.astRecord = astRecord;
        this.targetIndex = targetIndex;
        this.targetProperty = targetProperty;
    }
    get dehydrated() {
        return [];
    }
    get code() {
        throw new Error('RefBinding.prototype.code() not implemented');
    }
    get observedProperties() {
        return this.astRecord.ast.observedProperties;
    }
}
class TextBinding extends AbstractBinding {
    constructor(astRecord, targetIndex) {
        super();
        this.astRecord = astRecord;
        this.targetIndex = targetIndex;
    }
    get dehydrated() {
        return [];
    }
    get code() {
        return ts.createNew(ts.createIdentifier('TextBinding'), undefined, [
            ts.createCall(ts.createIdentifier(AbstractBinding.getAstFn), undefined, [
                ts.createLiteral(this.astRecord.id)
            ]),
            ts.createElementAccess(ts.createIdentifier(AbstractBinding.targetsAccessor), ts.createNumericLiteral(this.targetIndex.toString())),
            ts.createIdentifier('lookupFunctions')
        ]);
    }
    get observedProperties() {
        return this.astRecord.ast.observedProperties;
    }
}

const camelCasedCache = {};
function camelCase(name) {
    if (name in camelCasedCache) {
        return camelCasedCache[name];
    }
    const result = name.charAt(0).toLowerCase()
        + name.slice(1).replace(/[_.-](\w|$)/g, (_, x) => x.toUpperCase());
    return camelCasedCache[name] = result;
}
const capitalMatcher = /([A-Z])/g;
function addHyphenAndLower(char) {
    return '-' + char.toLowerCase();
}
const hyphenatedCache = {};
function hyphenate(name) {
    if (name in hyphenatedCache) {
        return hyphenatedCache[name];
    }
    return hyphenatedCache[name] = (name.charAt(0).toLowerCase() + name.slice(1)).replace(capitalMatcher, addHyphenAndLower);
}
function arrayRemove(arr, item) {
    let idx = arr.indexOf(item);
    if (idx !== -1) {
        arr.splice(idx, 1);
        return true;
    }
    return false;
}

function resolveBindingMode(mode) {
    switch (mode) {
        case 'oneTime': return bindingMode.oneTime;
        case 'toView':
        case 'oneTway': return bindingMode.toView;
        case 'twoWay': return bindingMode.twoWay;
        case 'fromView': return bindingMode.fromView;
    }
    console.log(`Cannot resolve binding mode for mode: [${mode}].`);
    return undefined;
}
function getObjectPropertyValue(obj, name) {
    let properties = obj.properties;
    if (!properties || !properties.length) {
        return undefined;
    }
    for (let i = 0, ii = properties.length; ii > i; ++i) {
        let prop = properties[i];
        if (!ts.isPropertyAssignment(prop)) {
            continue;
        }
        let propName = prop.name;
        if (ts.isIdentifier(propName) && propName.escapedText.toString() === name) {
            return prop.initializer;
        }
    }
    return undefined;
}
function getBindableDecoratorBindingMode(dec) {
    let expression = dec.expression;
    if (!ts.isCallExpression(expression)) {
        return undefined;
    }
    let args = expression.arguments;
    if (!args || !args.length) {
        return undefined;
    }
    if (args.length > 1) {
        console.log('@bindable() used with more than 1 parameter.');
    }
    let config = expression.arguments[0];
    if (!ts.isObjectLiteralExpression(config)) {
        return undefined;
    }
    let propValue = getObjectPropertyValue(config, 'defaultBindingMode');
    if (!propValue) {
        return undefined;
    }
    if (!ts.isPropertyAccessExpression(propValue)) {
        return undefined;
    }
    expression = propValue.expression;
    if (!ts.isIdentifier(expression)) {
        return undefined;
    }
    let accessedObjName = expression.escapedText.toString();
    if (accessedObjName !== 'bindingMode') {
        return undefined;
    }
    let mode = propValue.name.escapedText.toString();
    return resolveBindingMode(mode);
}
function getBindableDecoratorPrimaryPropertyValue(dec) {
    let expression = dec.expression;
    if (!ts.isCallExpression(expression)) {
        return false;
    }
    let args = expression.arguments;
    if (!args || !args.length) {
        return false;
    }
    if (args.length > 1) {
        console.log('@bindable() used with more than 1 parameter.');
    }
    let config = expression.arguments[0];
    if (!ts.isObjectLiteralExpression(config)) {
        return false;
    }
    let propValue = getObjectPropertyValue(config, 'primaryProperty');
    if (!propValue) {
        return false;
    }
    if (!ts.isToken(propValue)) {
        return false;
    }
    return propValue.kind === ts.SyntaxKind.TrueKeyword;
}
function getDecoratorByName(decorators, name) {
    return decorators.slice(0).find(dec => {
        let expression = dec.expression;
        if (ts.isCallExpression(expression)) {
            let innerExpression = expression.expression;
            return ts.isIdentifier(innerExpression) && innerExpression.escapedText.toString() === name;
        }
        else if (ts.isIdentifier(dec.expression)) {
            return dec.expression.escapedText.toString() === name;
        }
        return false;
    }) || null;
}
function getBindableDecorator(prop) {
    if (!prop.decorators) {
        return null;
    }
    return getDecoratorByName(prop.decorators, 'bindable');
}
function normalizeElementClassName(name) {
    name = typeof name === 'string'
        ? name
        : ts.isIdentifier(name)
            ? name.escapedText.toString()
            : name.name
                ? name.name.escapedText.toString()
                : 'Anonymous';
    return name.replace(/CustomElement$/, '');
}
function getBehaviorHtmlName(name) {
    return hyphenate(normalizeElementClassName(name));
}
function getPrivateClassName(name) {
    return `$${typeof name === 'string'
        ? name
        : ts.isIdentifier(name)
            ? name.escapedText.toString()
            : name.name
                ? name.name.escapedText.toString()
                : 'Anonymous'}`;
}
function removeExport(modifiers) {
    if (!modifiers) {
        return modifiers;
    }
    let idx = modifiers.findIndex(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (idx !== -1) {
        let mods = [...modifiers];
        mods.splice(idx, 1);
        return mods;
    }
    return modifiers;
}

class TemplateTransformer {
    constructor(templateFactory, emitImport = true) {
        this.templateFactory = templateFactory;
        this.emitImport = emitImport;
        this.observerPropName = '$observers';
        this.templatePropName = '$html';
        this.bindingPropName = '$bindings';
        this.elementAnchorPropName = '$anchor';
        this.elementViewPropName = '$view';
        this.elementScopePropName = '$scope';
        this.behaviorCounter = 0;
    }
    get code() {
        let factory = this.templateFactory;
        let observedProperties = factory.observedProperties;
        let elResource = factory.elementResource;
        if (!elResource) {
            throw new Error('Template without element resource not supported');
        }
        let baseVmClassName = elResource.name;
        let privateVmClassName = getPrivateClassName(baseVmClassName);
        return {
            imports: (this.emitImport
                ? [
                    this.createImport(['createOverrideContext'], './framework/binding/scope'),
                    this.createImport(['getAst'], './asts'),
                    this.createImport(['Binding', 'TextBinding', 'Listener'], './framework/binding/binding'),
                    this.createImport(['Observer'], './framework/binding/property-observation'),
                    this.createImport(['Template'], './framework/templating/template'),
                ]
                : []).concat(this.createAureliaDepenciesImport()),
            view: ts.createClassDeclaration(undefined, [
                ts.createToken(ts.SyntaxKind.ExportKeyword)
            ], baseVmClassName, undefined, [
                ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                    ts.createExpressionWithTypeArguments(undefined, ts.createIdentifier(privateVmClassName))
                ]),
            ], [
                this.createTemplateProp(),
                this.createViewClassConstructor(),
                this.createInitMethod(privateVmClassName),
                ...this.createLifecycleMethods(),
                ...observedProperties.reduce((propDeclarations, op) => {
                    return [
                        ...propDeclarations,
                        this.createObserverGetter(op),
                        this.createObserverSetter(op)
                    ];
                }, []),
            ]),
        };
    }
    createImport(names, moduleName) {
        return ts.createImportDeclaration(undefined, undefined, ts.createImportClause(undefined, ts.createNamedImports(names.map(n => ts.createImportSpecifier(undefined, ts.createIdentifier(n))))), ts.createLiteral(moduleName));
    }
    createViewClassConstructor() {
        return ts.createConstructor(undefined, undefined, [], ts.createBlock([
            ts.createStatement(ts.createCall(ts.createSuper(), undefined, undefined)),
            ts.createStatement(ts.createAssignment(ts.createPropertyAccess(ts.createThis(), this.elementScopePropName), ts.createObjectLiteral([
                ts.createPropertyAssignment('bindingContext', ts.createThis()),
                ts.createPropertyAssignment('overrideContext', ts.createCall(ts.createIdentifier('createOverrideContext'), undefined, [
                    ts.createThis()
                ]))
            ], true))),
        ], true));
    }
    createTemplateProp() {
        return ts.createProperty(undefined, [
            ts.createToken(ts.SyntaxKind.StaticKeyword)
        ], this.templatePropName, undefined, undefined, ts.createNew(ts.createIdentifier('Template'), undefined, [
            ts.createNoSubstitutionTemplateLiteral(this.templateFactory.html)
        ]));
    }
    createInitMethod(viewClassName) {
        return ts.createMethod(undefined, undefined, undefined, 'applyTo', undefined, undefined, [
            ts.createParameter(undefined, undefined, undefined, 'anchor', undefined, undefined, undefined)
        ], undefined, ts.createBlock([
            ts.createStatement(ts.createAssignment(ts.createPropertyAccess(ts.createThis(), this.elementAnchorPropName), ts.createIdentifier('anchor'))),
            ts.createStatement(ts.createAssignment(ts.createPropertyAccess(ts.createThis(), this.elementViewPropName), ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createIdentifier(viewClassName), this.templatePropName), 'create'), undefined, undefined))),
            ts.createVariableStatement(undefined, [
                ts.createVariableDeclaration(AbstractBinding.targetsAccessor, undefined, ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.elementViewPropName), AbstractBinding.targetsAccessor)),
            ]),
            ts.createStatement(ts.createAssignment(ts.createPropertyAccess(ts.createThis(), this.bindingPropName), ts.createArrayLiteral(this.templateFactory.bindings.map(b => {
                return b.behavior ? this.createBehaviorBinding(b) : b.code;
            }), true))),
            ts.createReturn(ts.createThis())
        ], true));
    }
    createLifecycleMethods() {
        return [
            ts.createMethod(undefined, undefined, undefined, TemplateTransformer.lifecycleMethods.bind, undefined, undefined, undefined, undefined, ts.createBlock([
                ts.createVariableStatement(undefined, [
                    ts.createVariableDeclaration(this.elementScopePropName, undefined, ts.createPropertyAccess(ts.createThis(), this.elementScopePropName))
                ]),
                ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.bindingPropName), 'forEach'), undefined, [
                    ts.createArrowFunction(undefined, undefined, [
                        ts.createParameter(undefined, undefined, undefined, 'b', undefined, undefined, undefined)
                    ], undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.createBlock([
                        ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createIdentifier('b'), TemplateTransformer.lifecycleMethods.bind), undefined, [
                            ts.createIdentifier(this.elementScopePropName)
                        ]))
                    ], true))
                ])),
                ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createSuper(), ts.createIdentifier('bind')), undefined, [
                    ts.createIdentifier(this.elementScopePropName)
                ]))
            ], true)),
            ts.createMethod(undefined, undefined, undefined, TemplateTransformer.lifecycleMethods.attach, undefined, undefined, undefined, undefined, ts.createBlock([
                ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.elementViewPropName), 'appendTo'), undefined, [
                    ts.createPropertyAccess(ts.createThis(), this.elementAnchorPropName)
                ]))
            ], true)),
            ts.createMethod(undefined, undefined, undefined, TemplateTransformer.lifecycleMethods.detach, undefined, undefined, undefined, undefined, ts.createBlock([
                ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.elementViewPropName), 'remove'), undefined, undefined))
            ], true)),
            ts.createMethod(undefined, undefined, undefined, TemplateTransformer.lifecycleMethods.unbind, undefined, undefined, undefined, undefined, ts.createBlock([
                ts.createVariableStatement(undefined, [
                    ts.createVariableDeclaration(this.elementScopePropName, undefined, ts.createPropertyAccess(ts.createThis(), this.elementScopePropName))
                ]),
                ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.bindingPropName), 'forEach'), undefined, [
                    ts.createArrowFunction(undefined, undefined, [
                        ts.createParameter(undefined, undefined, undefined, 'b', undefined, undefined, undefined)
                    ], undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.createBlock([
                        ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createIdentifier('b'), TemplateTransformer.lifecycleMethods.unbind), undefined, [
                            ts.createIdentifier(this.elementScopePropName)
                        ]))
                    ], true))
                ]))
            ], true)),
        ];
    }
    createBehaviorBinding(b) {
        return ts.createBinary(ts.createPropertyAccess(ts.createThis(), `$b${b.behaviorIndex}`), ts.SyntaxKind.EqualsToken, b.code);
    }
    createObserverGetter(name) {
        return ts.createGetAccessor(undefined, [], name, undefined, undefined, ts.createBlock([
            ts.createReturn(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.observerPropName), name), 'getValue'), undefined, undefined))
        ]));
    }
    createObserverSetter(name, paramName = 'v', type) {
        return ts.createSetAccessor(undefined, [], name, [
            ts.createParameter(undefined, undefined, undefined, paramName, undefined, undefined, undefined)
        ], ts.createBlock([
            ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), this.observerPropName), name), 'setValue'), undefined, [
                ts.createIdentifier(paramName)
            ]))
        ]));
    }
    createAureliaDepenciesImport() {
        let factory = this.templateFactory;
        let stmts = [];
        factory.usedDependencies.forEach((deps, auModule) => {
            stmts.push(this.createImport(deps.map(dep => dep.name), auModule.fileName));
        });
        return stmts;
    }
}
TemplateTransformer.lifecycleMethods = {
    created: 'created',
    bind: 'bind',
    unbind: 'unbind',
    attach: 'attach',
    detach: 'detach'
};

class TemplateFactory {
    constructor(owner, elementResource) {
        this.owner = owner;
        this.html = '';
        this.bindings = [];
        this.dependencies = [];
        this.usedDependencies = new Map();
        this._lastCustomElementIndex = 0;
        this.elementResource = elementResource;
    }
    get observedProperties() {
        let props = [];
        for (let bindings = this.bindings, i = 0, ii = bindings.length; ii > i; ++i) {
            let binding = bindings[i];
            let obProps = binding.observedProperties;
            for (let j = 0, jj = obProps.length; jj > j; ++j) {
                let prop = obProps[j];
                if (props.includes(prop)) {
                    continue;
                }
                props.push(prop);
            }
        }
        return props;
    }
    get lastTargetIndex() {
        const bindings = this.bindings;
        const lastBinding = bindings[bindings.length - 1];
        return lastBinding ? lastBinding.targetIndex : -1;
    }
    get lastBehaviorIndex() {
        const bindings = this.bindings;
        let i = bindings.length;
        while (i--) {
            let binding = bindings[i];
            if (binding.behavior) {
                return binding.behaviorIndex;
            }
        }
        return -1;
    }
    addDependency(dependency) {
        let deps = this.dependencies;
        let existing = deps.find(r => r.fileName === dependency.fileName);
        if (existing) {
            throw new Error('Already added this resource');
        }
        deps.push(dependency);
    }
    getCustomElement(htmlName) {
        let elementResource;
        if (this.owner) {
            elementResource = this.owner.getCustomElement(htmlName);
        }
        if (elementResource) {
            return elementResource;
        }
        for (let dependency of this.dependencies) {
            if (elementResource = dependency.getCustomElement(htmlName)) {
                return elementResource;
            }
        }
        return null;
    }
    getCode(emitImports) {
        let templateCode = new TemplateTransformer(this, emitImports).code;
        return {
            imports: templateCode.imports,
            view: templateCode.view
        };
    }
    transform(emitImport) {
        let file = ts.createSourceFile(this.owner.fileName, '', ts.ScriptTarget.Latest);
        let templateCode = new TemplateTransformer(this, emitImport).code;
        return ts.updateSourceFileNode(file, [
            ...templateCode.imports,
            ...this.dependencies.reduce((statements, dep) => {
                return statements.concat(dep.toSourceFile().statements);
            }, []),
            templateCode.view
        ]);
    }
    getUsedDependency() {
        return new TemplateTransformer(this).createAureliaDepenciesImport();
    }
}

class CustomElementBinding extends AbstractBinding {
    constructor(elementResource, targetIndex, behaviorIndex) {
        super();
        this.elementResource = elementResource;
        this.targetIndex = targetIndex;
        this.behaviorIndex = behaviorIndex;
        this.behavior = true;
    }
    get dehydrated() {
        return [];
    }
    get code() {
        return ts.createCall(ts.createPropertyAccess(ts.createNew(ts.createIdentifier(this.elementResource.name), undefined, undefined), 'applyTo'), undefined, [
            ts.createElementAccess(ts.createIdentifier(AbstractBinding.targetsAccessor), ts.createNumericLiteral(this.targetIndex.toString()))
        ]);
    }
    get observedProperties() {
        return [];
    }
}

class ViewCompiler {
    constructor(parser, bindingLanguage) {
        this.parser = parser;
        this.bindingLanguage = bindingLanguage;
    }
    compileWithModule(fileName, aureliaModule) {
        let templates = aureliaModule.templates;
        let mainTemplate = templates[0];
        let importFiles = this.extractTemplateImports(mainTemplate);
        let dependencies = importFiles.map(depFileName => {
            let depModule = this.moduleCompiler.compile(aureliaPath.relativeToFile(depFileName, fileName));
            return depModule;
        });
        let factory = this.compile(fileName, mainTemplate, aureliaModule, dependencies, aureliaModule.mainResource);
        aureliaModule.addFactory(factory);
        dependencies.forEach(dep => {
            factory.addDependency(this.compileWithModule(dep.fileName, dep));
        });
        return aureliaModule;
    }
    compile(fileName, template, aureliaModule, dependencyModules, elRes) {
        let factory = new TemplateFactory(aureliaModule, elRes);
        let node;
        let element;
        if (typeof template === 'string') {
            element = DOM.createTemplateFromMarkup(template);
            node = element.content;
        }
        else {
            element = template;
            node = template.tagName.toLowerCase() === 'template' ? template.content : template;
        }
        this.compileNode(node, aureliaModule, factory, dependencyModules, element);
        factory.html = element.innerHTML.trim();
        factory.owner = aureliaModule;
        return factory;
    }
    extractTemplateImports(template) {
        const imports = Array.from(template.getElementsByTagName('import'));
        const requires = Array.from(template.getElementsByTagName('require'));
        const importModules = [];
        while (imports.length) {
            let $import = imports[0];
            let moduleId = $import.getAttribute('from');
            if (!moduleId) {
                throw new Error('Invalid <import/> element. No "from" attribute specifier.');
            }
            importModules.push(moduleId);
            ($import.parentNode || template).removeChild($import);
            arrayRemove(imports, $import);
        }
        let hasRequires = false;
        while (requires.length) {
            let $require = requires[0];
            let moduleId = $require.getAttribute('from');
            if (!moduleId) {
                throw new Error('Invalid <require/> element. No "from" attribute specifier.');
            }
            importModules.push(moduleId);
            hasRequires = true;
            ($require.parentNode || template).removeChild($require);
            arrayRemove(requires, $require);
        }
        if (hasRequires) {
            console.log('Use <import from="..." /> instead of <require/>. <require/> was used to support IE11 as IE11 does NOT allow <import />.');
        }
        return importModules;
    }
    compileNode(node, resourceModule, templateFactory, dependencyModules, parentNode) {
        switch (node.nodeType) {
            case 1:
                return this.compileElement(node, resourceModule, templateFactory, dependencyModules, parentNode);
            case 3:
                let templateLiteralExpression = this.bindingLanguage.inspectTextContent(node.textContent || '');
                if (templateLiteralExpression) {
                    let marker = document.createElement('au-marker');
                    marker.className = 'au';
                    (node.parentNode || parentNode).insertBefore(marker, node);
                    node.textContent = ' ';
                    while (node.nextSibling && node.nextSibling.nodeType === 3) {
                        (node.parentNode || parentNode).removeChild(node.nextSibling);
                    }
                    let lastIndex = templateFactory.lastTargetIndex;
                    templateFactory.bindings.push(new TextBinding(Parser.addAst(node.textContent, templateLiteralExpression), lastIndex + 1));
                }
                else {
                    while (node.nextSibling && node.nextSibling.nodeType === 3) {
                        node = node.nextSibling;
                    }
                }
                return node.nextSibling;
            case 11:
                let currentChild = node.firstChild;
                while (currentChild) {
                    currentChild = this.compileNode(currentChild, resourceModule, templateFactory, dependencyModules, parentNode);
                }
                break;
            default:
                break;
        }
        return node.nextSibling;
    }
    compileElement(node, resourceModule, templateFactory, dependencyModules, parentNode) {
        let hasBinding = false;
        let lastIndex = templateFactory.lastTargetIndex;
        let elementResource = templateFactory.getCustomElement(node.tagName);
        if (!elementResource) {
            for (let i = 0, ii = dependencyModules.length; ii > i; ++i) {
                let dep = dependencyModules[i];
                elementResource = dep.getCustomElement(node.tagName);
                if (elementResource) {
                    let existingDepedencies = templateFactory.usedDependencies.get(dep);
                    if (!existingDepedencies) {
                        templateFactory.usedDependencies.set(dep, existingDepedencies = []);
                    }
                    let existed = false;
                    for (let j = 0, jj = existingDepedencies.length; jj > j; ++j) {
                        let existingDep = existingDepedencies[j];
                        if (existingDep.kind === resourceKind.element && existingDep.name === elementResource.name) {
                            existed = true;
                            break;
                        }
                    }
                    if (!existed) {
                        existingDepedencies.push(elementResource);
                    }
                    break;
                }
            }
        }
        let elementBinding;
        if (elementResource) {
            templateFactory.bindings.push(elementBinding = new CustomElementBinding(elementResource, lastIndex + 1, templateFactory.lastBehaviorIndex + 1));
        }
        for (let i = 0; i < node.attributes.length; ++i) {
            let attr = node.attributes[i];
            let binding = this.bindingLanguage.inspectAttribute(node, attr.nodeName, attr.value, lastIndex + 1, elementResource, templateFactory, resourceModule);
            if (binding) {
                templateFactory.bindings.push(binding);
                hasBinding = true;
                node.removeAttribute(attr.nodeName);
                --i;
            }
        }
        if (hasBinding) {
            node.classList.add('au');
        }
        let currentChild = node.firstChild;
        while (currentChild) {
            currentChild = this.compileNode(currentChild, resourceModule, templateFactory, dependencyModules, parentNode);
        }
        return node.nextSibling;
    }
}
ViewCompiler.inject = [Parser, 'IBindingLanguage'];

class HtmlBehavior {
    constructor(owner, name) {
        this.owner = owner;
        this.name = name;
        this.htmlName = getBehaviorHtmlName(name);
    }
    getBindable(htmlName) {
        return this.bindables[htmlName] || null;
    }
    get hasConstructor() {
        return this.lifeCycles.ctor === true;
    }
}
class ElementResource extends HtmlBehavior {
    constructor(owner, name, bindables, initializers, lifeCycles) {
        super(owner, name);
        this.bindables = bindables;
        this.initializers = initializers;
        this.lifeCycles = lifeCycles;
        this.kind = resourceKind.element;
    }
    get code() {
        return null;
    }
}
class AttributeResource extends HtmlBehavior {
    constructor(owner, name, bindables, initializers, lifeCycles) {
        super(owner, name);
        this.bindables = bindables;
        this.initializers = initializers;
        this.lifeCycles = lifeCycles;
        this.kind = resourceKind.attribute;
        this.primaryProperty = this.getPrimaryProperty(bindables);
    }
    get code() {
        return null;
    }
    getPrimaryProperty(bindables) {
        for (let prop in bindables) {
            let bindable = bindables[prop];
            if (bindable.primaryProperty) {
                return bindable;
            }
        }
        return undefined;
    }
}

class BindableProperty {
    constructor(config) {
        this.name = config.name;
        this.type = config.type || 'string';
        this.attribute = config.attribute || hyphenate(config.name);
        this.defaultValue = config.defaultValue;
        this.primaryProperty = config.primaryProperty;
    }
    get code() {
        throw new Error('Not implemented');
    }
}

function getClassName(klass) {
    return klass.name
        ? klass.name.escapedText.toString()
        : 'Anonymous';
}
function isExportedClass(klass) {
    return klass.kind === ts.SyntaxKind.ClassDeclaration
        && ((ts.getCombinedModifierFlags(klass)
            | ts.ModifierFlags.Export) === ts.ModifierFlags.Export);
}
function isCustomElement(klass) {
    if (!isExportedClass(klass)) {
        return false;
    }
    let name = getClassName(klass);
    if (/\w+CustomElement$/.test(name)) {
        return true;
    }
    const decorators = klass.decorators;
    if (!decorators) {
        return false;
    }
    let ceDec = getDecoratorByName(decorators, 'customElement');
    if (ceDec) {
        return true;
    }
    return false;
}
function isCustomAttribute(klass) {
    if (!isExportedClass(klass)) {
        return false;
    }
    let name = getClassName(klass);
    if (/\w+CustomAttribute$/.test(name)) {
        return true;
    }
    const decorators = klass.decorators;
    if (!decorators) {
        return false;
    }
    let caDec = getDecoratorByName(decorators, 'customAttribute');
    if (caDec) {
        return true;
    }
    return false;
}
function isValueConverter(klass) {
    if (!isExportedClass(klass)) {
        return false;
    }
    let name = getClassName(klass);
    if (/\w+ValueConverter$/.test(name)) {
        return true;
    }
    const decorators = klass.decorators;
    if (!decorators) {
        return false;
    }
    let caDec = getDecoratorByName(decorators, 'valueConverter');
    if (caDec) {
        return true;
    }
    return false;
}
function isBindingBehavior(klass) {
    if (!isExportedClass(klass)) {
        return false;
    }
    let name = getClassName(klass);
    if (/\w+BindingBehavior$/.test(name)) {
        return true;
    }
    const decorators = klass.decorators;
    if (!decorators) {
        return false;
    }
    let caDec = getDecoratorByName(decorators, 'bindingBehavior');
    if (caDec) {
        return true;
    }
    return false;
}
function removeClassExport(klass) {
    return ts.updateClassDeclaration(klass, klass.decorators, removeExport(klass.modifiers), klass.name, klass.typeParameters, klass.heritageClauses, klass.members);
}

class AureliaModuleTransformer {
    constructor(module, file, scriptTarget = ts.ScriptTarget.Latest) {
        this.module = module;
        this.file = file;
        this.scriptTarget = scriptTarget;
    }
    transform() {
        let updatedStatements = this.file.getSourceFile().statements.reduce((statements, statement, idx) => {
            if (isCustomElement(statement)) {
                return statements.concat(this.transformCustomElement(statement));
            }
            else if (isCustomAttribute(statement)) {
                throw new Error('Custom attribute not supported');
            }
            else {
                return statements.concat(statement);
            }
        }, []);
        return updatedStatements;
    }
    transformCustomElement(klass) {
        let viewModelClassName = getClassName(klass);
        let privateBaseClassName = getPrivateClassName(viewModelClassName);
        klass = ts.updateClassDeclaration(klass, Array.isArray(klass.decorators) ? this.updateElementDecorators([...klass.decorators]) : undefined, klass.modifiers, ts.createIdentifier(privateBaseClassName), klass.typeParameters, klass.heritageClauses, klass.members);
        klass = removeClassExport(klass);
        klass = this.updateCustomElementClassMembers(klass, this.module.mainResource);
        return klass;
    }
    updateCustomElementClassMembers(klass, metadata) {
        let factory = this.module.templateFactories[0];
        let observedProperties = factory ? factory.observedProperties : [];
        let shouldDefineObservers = observedProperties.length > 0;
        let members = klass.members.reduce((allMembers, member) => {
            let $decorators = [...(Array.isArray(member.decorators) ? member.decorators : [])];
            if (ts.isConstructorDeclaration(member) && shouldDefineObservers) {
                allMembers.push(this.updateConstructor(member, observedProperties, metadata.initializers));
                return allMembers;
            }
            if (!ts.isPropertyDeclaration(member)) {
                allMembers.push(member);
                return allMembers;
            }
            let nameAst = member.name;
            if (ts.isComputedPropertyName(nameAst)) {
                throw new Error('Cannot use bindable on computed property');
            }
            let memberName;
            if (ts.isIdentifier(nameAst)) {
                memberName = nameAst.escapedText.toString();
            }
            else {
                memberName = nameAst.text.toString();
            }
            if (observedProperties.includes(memberName)) {
                return allMembers;
            }
            let bindableDecorator = getBindableDecorator(member);
            if (bindableDecorator === null) {
                return allMembers;
            }
            arrayRemove($decorators, bindableDecorator);
            allMembers.push(ts.updateProperty(member, $decorators, member.modifiers, nameAst, member.questionToken, member.type, member.initializer));
            return allMembers;
        }, !metadata.hasConstructor && shouldDefineObservers
            ? [this.updateConstructor(ts.createConstructor(undefined, undefined, [], undefined), observedProperties, metadata.initializers)]
            : []);
        return ts.updateClassDeclaration(klass, klass.decorators, klass.modifiers, klass.name, klass.typeParameters, klass.heritageClauses, members);
    }
    updateElementDecorators(decorators) {
        let customElementDecorator = getDecoratorByName(decorators, 'customElement');
        if (customElementDecorator) {
            arrayRemove(decorators, customElementDecorator);
        }
        return decorators;
    }
    createDefineObservers(observedProperties, initializers) {
        return ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createIdentifier('Object'), 'defineProperty'), undefined, [
            ts.createThis(),
            ts.createLiteral('$observers'),
            ts.createObjectLiteral([
                ts.createPropertyAssignment('value', ts.createObjectLiteral(observedProperties.map(op => {
                    return ts.createPropertyAssignment(op, ts.createNew(ts.createIdentifier('Observer'), undefined, op in initializers
                        ? [initializers[op]]
                        : undefined));
                }), true)),
                ts.createPropertyAssignment('configurable', ts.createTrue())
            ], true)
        ]));
    }
    updateConstructor(ctor, observedProperties, initializers) {
        return ts.updateConstructor(ctor, ctor.decorators, ctor.modifiers, ctor.parameters, ts.createBlock(ctor.body && ctor.body.statements
            ? [
                this.createDefineObservers(observedProperties, initializers),
                ...ctor.body.statements
            ]
            : [this.createDefineObservers(observedProperties, initializers)], true));
    }
}

class AureliaResourceModule {
    constructor(fileName, text, moduleCompiler) {
        this.fileName = fileName;
        this.text = text;
        this.moduleCompiler = moduleCompiler;
        this.elements = {};
        this.attributes = {};
        this.valueConverters = {};
        this.bindingBehaviors = {};
        this.extractMetadata(this.file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest));
    }
    extractMetadata(file) {
        file.getSourceFile().statements.forEach((statement) => {
            if (isCustomElement(statement)) {
                this.addCustomElement(this.extractCustomElementMetdata(statement));
            }
            else if (isCustomAttribute(statement)) {
                this.addCustomAttribute(this.extractCustomAttributeMetadata(statement));
            }
            else if (isValueConverter(statement)) {
                console.log('TODO: implement value converter');
            }
            else if (isBindingBehavior(statement)) {
                console.log('TODO: implement binding behavior');
            }
        });
    }
    extractCustomElementMetdata(klass) {
        let viewModelClassName = getClassName(klass);
        let bindables = {};
        let initializers = {};
        let lifeCycles = {};
        this.extractClassMemberMetadata(klass, bindables, initializers, lifeCycles);
        return new ElementResource(this, viewModelClassName, bindables, initializers, lifeCycles);
    }
    extractCustomAttributeMetadata(klass) {
        let viewModelClassName = getClassName(klass);
        let bindables = {};
        let initializers = {};
        let lifeCycles = {};
        this.extractClassMemberMetadata(klass, bindables, initializers, lifeCycles);
        return new AttributeResource(this, viewModelClassName, bindables, initializers, lifeCycles);
    }
    extractClassMemberMetadata(klass, bindables, initializers, lifeCycles, isAttr = false) {
        let primary;
        klass.members.forEach(member => {
            if (ts.isConstructorDeclaration(member)) {
                lifeCycles.ctor = true;
                return;
            }
            if (!ts.isPropertyDeclaration(member)) {
                return;
            }
            let nameAst = member.name;
            if (ts.isComputedPropertyName(nameAst)) {
                throw new Error('Cannot use bindable on computed property');
            }
            let memberName;
            if (ts.isIdentifier(nameAst)) {
                memberName = nameAst.escapedText.toString();
            }
            else {
                memberName = nameAst.text.toString();
            }
            if (member.initializer) {
                initializers[memberName] = member.initializer;
            }
            let bindableDecorator = getBindableDecorator(member);
            if (bindableDecorator === null) {
                return;
            }
            let bindableAttrName = hyphenate(memberName);
            let bindableConfig = {
                name: memberName,
                defaultBindingMode: getBindableDecoratorBindingMode(bindableDecorator) || bindingMode.toView,
                defaultValue: member.initializer,
            };
            let bindable = bindables[bindableAttrName] = new BindableProperty(bindableConfig);
            if (isAttr) {
                let isPrimary = getBindableDecoratorPrimaryPropertyValue(bindableDecorator);
                if (isPrimary) {
                    if (primary) {
                        throw new Error('Cannot have two custom primary properties on one custom attribute.');
                    }
                    primary = bindable;
                    bindable.primaryProperty = true;
                }
            }
        });
    }
    getGlobalResources() {
        return AureliaResourceModule.globalModule;
    }
    addFactory(factory) {
        (this.templateFactories || (this.templateFactories = [])).push(factory);
        return this;
    }
    getCustomElement(htmlName) {
        return this.elements[htmlName] || (this.global ? null : this.getGlobalResources().getCustomElement(htmlName)) || null;
    }
    getCustomElements() {
        return Object.keys(this.elements).map(el => this.elements[el]);
    }
    addCustomElement(el) {
        if (this.elements[el.htmlName]) {
            throw new Error('Custom element with same name already existed');
        }
        if (!this.mainResource) {
            this.mainResource = el;
        }
        return this.elements[el.htmlName] = el;
    }
    getCustomAttribute(htmlName) {
        return this.attributes[htmlName] || (this.global ? null : this.getGlobalResources().getCustomAttribute(htmlName)) || null;
    }
    getCustomAttributes() {
        return Object.keys(this.attributes).map(attr => this.attributes[attr]);
    }
    addCustomAttribute(attr) {
        if (this.attributes[attr.htmlName]) {
            throw new Error('Custom attribute with same name already existed');
        }
        return this.attributes[attr.htmlName] = attr;
    }
    getValueConverters() {
        return Object.keys(this.valueConverters).map(vc => this.valueConverters[vc]);
    }
    getBindingBehaviors() {
        return Object.keys(this.bindingBehaviors).map(bb => this.bindingBehaviors[bb]);
    }
    toStatements(file, emitImports) {
        let factories = this.templateFactories;
        let mainFactory = factories[0];
        let mainFactoryCode = mainFactory.getCode(emitImports);
        let depModules = [];
        return {
            imports: mainFactoryCode.imports,
            view: mainFactoryCode.view,
            originals: new AureliaModuleTransformer(this, file).transform(),
            deps: depModules
        };
    }
    toSourceFile(emitImport) {
        let imports;
        let file = ts.createSourceFile(this.fileName, '', ts.ScriptTarget.Latest);
        let factories = this.templateFactories;
        let mainFactory = factories[0];
        let mainFactoryCode = mainFactory.getCode();
        imports = mainFactoryCode.imports;
        return ts.updateSourceFileNode(file, [
            ...imports,
            ...this.file.statements,
        ]);
    }
    compile() {
        return ts.createPrinter().printFile(this.toSourceFile(true));
    }
    toString() {
        try {
            let synthesizedFile = ts.createSourceFile(this.fileName, '', ts.ScriptTarget.Latest);
            let moduleStatements = this.toStatements(this.file, true);
            return ts.createPrinter().printFile(ts.updateSourceFileNode(synthesizedFile, [
                ...moduleStatements.imports,
                ...moduleStatements.originals,
                moduleStatements.view
            ]));
        }
        catch (ex) {
            console.log(ex);
            return '';
        }
    }
    toJSON() {
        throw new Error('IAureliaModule.toJson() not implemented.');
    }
}

class AureliaModuleCompiler {
    constructor(viewCompiler, fileUtils) {
        this.viewCompiler = viewCompiler;
        this.fileUtils = fileUtils;
        this.moduleRegistry = {};
    }
    compile(fileName, content, noRecompile) {
        let resolvedFileName = this.resolveFile(fileName);
        let existing = this.moduleRegistry[resolvedFileName];
        if (noRecompile && existing) {
            return existing;
        }
        let compiledModule = this.parseFile(resolvedFileName, content);
        this.moduleRegistry[resolvedFileName] = compiledModule;
        return compiledModule;
    }
    parseFile(fileName, content) {
        let ext = (/\.(au|ts|js)$/.exec(fileName) || [])[1];
        switch (ext) {
            case 'au': return this.parseAuFile(fileName, content = content || this.fileUtils.readFileSync(fileName));
            case 'ts': return this.parseTsFile(fileName, content = content || this.fileUtils.readFileSync(fileName));
            case 'js': return this.parseJsFile(fileName, content = content || this.fileUtils.readFileSync(fileName));
        }
        throw new Error('normal file not supported');
    }
    parseAuFile(fileName, content) {
        const modules = DOM.parseHtml(content);
        let viewModules = [];
        let viewModelModule;
        for (let i = 0; i < modules.children.length; ++i) {
            let child = modules.children[i];
            if (child.tagName.toUpperCase() === 'TEMPLATE') {
                viewModules.push(child);
            }
            else if (child.tagName.toUpperCase() === 'SCRIPT') {
                if (!viewModelModule) {
                    viewModelModule = child;
                }
            }
            else if (child.tagName.toUpperCase() === 'STYLE') {
            }
        }
        if (!viewModules.length || !viewModelModule) {
            throw new Error('Invalid Aurelia file. Expect both view & view model.');
        }
        let $partialAureliaModule = new AureliaResourceModule(fileName, viewModelModule.textContent || '', this);
        $partialAureliaModule.templates = viewModules;
        this.viewCompiler.compileWithModule(fileName, $partialAureliaModule);
        return $partialAureliaModule;
    }
    parseTsFile(fileName, content) {
        throw new Error('parseTsFile() not implemented.');
    }
    parseJsFile(fileName, content) {
        throw new Error('parseJsFile() not implemented.');
    }
    resolveFile(fileName) {
        let ext = (/\.(au|ts|js)$/.exec(fileName) || [])[1];
        let resolvedFileName = fileName;
        if (!ext) {
            if (this.fileUtils.existsSync(`${fileName}.au`)) {
                resolvedFileName = fileName + '.au';
                ext = 'au';
            }
            else if (this.fileUtils.existsSync(`${fileName}.js`)) {
                resolvedFileName = fileName + '.js';
                ext = 'js';
                throw new Error('Plain JavaScript file support not implemented.');
            }
            else if (this.fileUtils.existsSync(`${fileName}.ts`)) {
                resolvedFileName = fileName + '.ts';
                ext = 'ts';
                throw new Error('Plain TypeScript file support not implemented.');
            }
        }
        return resolvedFileName;
    }
    fromJson(fileName) {
        throw new Error('TODO: Not implemented');
    }
    emit(fileName, baseDir) {
        return new Promise((resolve, reject) => {
            let $module = this.moduleRegistry[fileName];
            if (!$module) {
                return reject(new Error('Invalid module. Module does not exist'));
            }
            resolve(this.fileUtils.writeFile(`${fileName.replace(/\.(au|ts|js)$/, '')}.js`, $module.toString()).then(success => {
                console.log(`Emitted module ${fileName} ${success ? 'Successfully' : 'Unsuccessfully'}`);
                return success;
            }));
        });
    }
    emitAll(baseDir) {
        console.log('Start emitting...');
        return Promise.all(Object.keys(this.moduleRegistry).map(fileName => this.emit(fileName, baseDir))).then(successes => {
            console.log('Emitted all modules.');
            return successes.every(Boolean);
        });
    }
}
AureliaModuleCompiler.inject = ['IViewCompiler', 'IFileUtils'];

class StrategyResolver {
    constructor(strategy, state) {
        this.strategy = strategy;
        this.state = state;
    }
    get(container, key) {
        switch (this.strategy) {
            case 0:
                return this.state;
            case 1:
                let singleton = container.invoke(this.state);
                this.state = singleton;
                this.strategy = 0;
                return singleton;
            case 2:
                return container.invoke(this.state);
            case 3:
                return this.state(container, key, this);
            case 4:
                return this.state[0].get(container, key);
            case 5:
                return container.get(this.state);
            default:
                throw new Error('Invalid strategy: ' + this.strategy);
        }
    }
}

class InvocationHandler {
    constructor(fn, invoker, dependencies) {
        this.fn = fn;
        this.invoker = invoker;
        this.dependencies = dependencies;
    }
    invoke(container, dynamicDependencies) {
        return dynamicDependencies !== undefined
            ? this.invoker.invokeWithDynamicDependencies(container, this.fn, this.dependencies, dynamicDependencies)
            : this.invoker.invoke(container, this.fn, this.dependencies);
    }
}

const _emptyParameters = Object.freeze([]);
class Container {
    constructor(configuration) {
        if (configuration === undefined) {
            configuration = {};
        }
        this._configuration = configuration;
        this._onHandlerCreated = configuration.onHandlerCreated;
        this._handlers = configuration.handlers || (configuration.handlers = new Map());
        this._resolvers = new Map();
        this.root = this;
        this.parent = null;
    }
    makeGlobal() {
        Container.instance = this;
        return this;
    }
    setHandlerCreatedCallback(onHandlerCreated) {
        this._onHandlerCreated = onHandlerCreated;
        this._configuration.onHandlerCreated = onHandlerCreated;
    }
    registerInstance(key, instance) {
        return this.registerResolver(key, new StrategyResolver(0, instance === undefined ? key : instance));
    }
    registerSingleton(key, fn) {
        return this.registerResolver(key, new StrategyResolver(1, fn === undefined ? key : fn));
    }
    registerTransient(key, fn) {
        return this.registerResolver(key, new StrategyResolver(2, fn === undefined ? key : fn));
    }
    registerHandler(key, handler) {
        return this.registerResolver(key, new StrategyResolver(3, handler));
    }
    registerAlias(originalKey, aliasKey) {
        return this.registerResolver(aliasKey, new StrategyResolver(5, originalKey));
    }
    registerResolver(key, resolver) {
        validateKey(key);
        let allResolvers = this._resolvers;
        let result = allResolvers.get(key);
        if (result === undefined) {
            allResolvers.set(key, resolver);
        }
        else if (result.strategy === 4) {
            result.state.push(resolver);
        }
        else {
            allResolvers.set(key, new StrategyResolver(4, [result, resolver]));
        }
        return resolver;
    }
    autoRegister(key, fn) {
        fn = fn === undefined ? key : fn;
        if (typeof fn === 'function') {
            return this.registerResolver(key, new StrategyResolver(1, fn));
        }
        return this.registerResolver(key, new StrategyResolver(0, fn));
    }
    autoRegisterAll(fns) {
        let i = fns.length;
        while (i--) {
            this.autoRegister(fns[i]);
        }
    }
    unregister(key) {
        this._resolvers.delete(key);
    }
    hasResolver(key, checkParent = false) {
        validateKey(key);
        return (this._resolvers.has(key) || (checkParent && this.parent !== null && this.parent.hasResolver(key, checkParent)));
    }
    getResolver(key) {
        return this._resolvers.get(key);
    }
    get(key) {
        validateKey(key);
        if (key === Container) {
            return this;
        }
        let resolver = this._resolvers.get(key);
        if (resolver === undefined) {
            if (this.parent === null) {
                return this.autoRegister(key).get(this, key);
            }
            return this.parent._get(key);
        }
        return resolver.get(this, key);
    }
    _get(key) {
        let resolver = this._resolvers.get(key);
        if (resolver === undefined) {
            if (this.parent === null) {
                return this.autoRegister(key).get(this, key);
            }
            return this.parent._get(key);
        }
        return resolver.get(this, key);
    }
    getAll(key) {
        validateKey(key);
        let resolver = this._resolvers.get(key);
        if (resolver === undefined) {
            if (this.parent === null) {
                return _emptyParameters;
            }
            return this.parent.getAll(key);
        }
        if (resolver.strategy === 4) {
            let state = resolver.state;
            let i = state.length;
            let results = new Array(i);
            while (i--) {
                results[i] = state[i].get(this, key);
            }
            return results;
        }
        return [resolver.get(this, key)];
    }
    createChild() {
        let child = new Container(this._configuration);
        child.root = this.root;
        child.parent = this;
        return child;
    }
    invoke(fn, dynamicDependencies) {
        try {
            let handler = this._handlers.get(fn);
            if (handler === undefined) {
                handler = this._createInvocationHandler(fn);
                this._handlers.set(fn, handler);
            }
            return handler.invoke(this, dynamicDependencies);
        }
        catch (e) {
            throw new Error(`Error invoking ${fn.name}.`);
        }
    }
    _createInvocationHandler(fn) {
        let dependencies;
        dependencies = [];
        let ctor = fn;
        while (typeof ctor === 'function') {
            dependencies.push(...getDependencies(ctor));
            ctor = Object.getPrototypeOf(ctor);
        }
        let invoker = classInvokers[dependencies.length] || classInvokers.fallback;
        let handler = new InvocationHandler(fn, invoker, dependencies);
        return this._onHandlerCreated !== undefined ? this._onHandlerCreated(handler) : handler;
    }
}
function invokeWithDynamicDependencies(container, fn, staticDependencies, dynamicDependencies) {
    let i = staticDependencies.length;
    let args = new Array(i);
    let lookup;
    while (i--) {
        lookup = staticDependencies[i];
        if (lookup === null || lookup === undefined) {
            throw new Error('Constructor Parameter with index ' +
                i +
                " cannot be null or undefined. Are you trying to inject/register something that doesn't exist with DI?");
        }
        else {
            args[i] = container.get(lookup);
        }
    }
    if (dynamicDependencies !== undefined) {
        args = args.concat(dynamicDependencies);
    }
    return Reflect.construct(fn, args);
}
let classInvokers = {
    0: {
        invoke(container, Type) {
            return new Type();
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    1: {
        invoke(container, Type, deps) {
            return new Type(container.get(deps[0]));
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    2: {
        invoke(container, Type, deps) {
            return new Type(container.get(deps[0]), container.get(deps[1]));
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    3: {
        invoke(container, Type, deps) {
            return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]));
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    4: {
        invoke(container, Type, deps) {
            return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]), container.get(deps[3]));
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    5: {
        invoke(container, Type, deps) {
            return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]), container.get(deps[3]), container.get(deps[4]));
        },
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    },
    fallback: {
        invoke: invokeWithDynamicDependencies,
        invokeWithDynamicDependencies: invokeWithDynamicDependencies
    }
};
function getDependencies(f) {
    if (!f.hasOwnProperty('inject')) {
        return [];
    }
    if (typeof f.inject === 'function') {
        return f.inject();
    }
    return f.inject;
}
function validateKey(key) {
    if (key === null || key === undefined) {
        throw new Error("key/value cannot be null or undefined. Are you trying to inject/register something that doesn't exist with DI?");
    }
}

let svgElements;
let svgPresentationElements;
let svgPresentationAttributes;
let svgAnalyzer;
svgElements = {
    a: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'target', 'transform', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyph: ['class', 'dx', 'dy', 'externalResourcesRequired', 'format', 'glyphRef', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    altGlyphDef: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyphItem: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    animate: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateColor: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateMotion: ['accumulate', 'additive', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keyPoints', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'origin', 'path', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'rotate', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateTransform: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'type', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    circle: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'r', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    clipPath: ['class', 'clipPathUnits', 'externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    'color-profile': ['id', 'local', 'name', 'rendering-intent', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    cursor: ['externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    defs: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    desc: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    ellipse: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    feBlend: ['class', 'height', 'id', 'in', 'in2', 'mode', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feColorMatrix: ['class', 'height', 'id', 'in', 'result', 'style', 'type', 'values', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComponentTransfer: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComposite: ['class', 'height', 'id', 'in', 'in2', 'k1', 'k2', 'k3', 'k4', 'operator', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feConvolveMatrix: ['bias', 'class', 'divisor', 'edgeMode', 'height', 'id', 'in', 'kernelMatrix', 'kernelUnitLength', 'order', 'preserveAlpha', 'result', 'style', 'targetX', 'targetY', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDiffuseLighting: ['class', 'diffuseConstant', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDisplacementMap: ['class', 'height', 'id', 'in', 'in2', 'result', 'scale', 'style', 'width', 'x', 'xChannelSelector', 'xml:base', 'xml:lang', 'xml:space', 'y', 'yChannelSelector'],
    feDistantLight: ['azimuth', 'elevation', 'id', 'xml:base', 'xml:lang', 'xml:space'],
    feFlood: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feFuncA: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncB: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncG: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncR: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feGaussianBlur: ['class', 'height', 'id', 'in', 'result', 'stdDeviation', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feImage: ['class', 'externalResourcesRequired', 'height', 'id', 'preserveAspectRatio', 'result', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMerge: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMergeNode: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    feMorphology: ['class', 'height', 'id', 'in', 'operator', 'radius', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feOffset: ['class', 'dx', 'dy', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    fePointLight: ['id', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feSpecularLighting: ['class', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'specularConstant', 'specularExponent', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feSpotLight: ['id', 'limitingConeAngle', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'specularExponent', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feTile: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feTurbulence: ['baseFrequency', 'class', 'height', 'id', 'numOctaves', 'result', 'seed', 'stitchTiles', 'style', 'type', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    filter: ['class', 'externalResourcesRequired', 'filterRes', 'filterUnits', 'height', 'id', 'primitiveUnits', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    font: ['class', 'externalResourcesRequired', 'horiz-adv-x', 'horiz-origin-x', 'horiz-origin-y', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face': ['accent-height', 'alphabetic', 'ascent', 'bbox', 'cap-height', 'descent', 'font-family', 'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight', 'hanging', 'id', 'ideographic', 'mathematical', 'overline-position', 'overline-thickness', 'panose-1', 'slope', 'stemh', 'stemv', 'strikethrough-position', 'strikethrough-thickness', 'underline-position', 'underline-thickness', 'unicode-range', 'units-per-em', 'v-alphabetic', 'v-hanging', 'v-ideographic', 'v-mathematical', 'widths', 'x-height', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-format': ['id', 'string', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-name': ['id', 'name', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-src': ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-uri': ['id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    foreignObject: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    g: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    glyph: ['arabic-form', 'class', 'd', 'glyph-name', 'horiz-adv-x', 'id', 'lang', 'orientation', 'style', 'unicode', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    glyphRef: ['class', 'dx', 'dy', 'format', 'glyphRef', 'id', 'style', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    hkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space'],
    image: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    line: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'x1', 'x2', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    linearGradient: ['class', 'externalResourcesRequired', 'gradientTransform', 'gradientUnits', 'id', 'spreadMethod', 'style', 'x1', 'x2', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    marker: ['class', 'externalResourcesRequired', 'id', 'markerHeight', 'markerUnits', 'markerWidth', 'orient', 'preserveAspectRatio', 'refX', 'refY', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    mask: ['class', 'externalResourcesRequired', 'height', 'id', 'maskContentUnits', 'maskUnits', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    metadata: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'missing-glyph': ['class', 'd', 'horiz-adv-x', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    mpath: ['externalResourcesRequired', 'id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    path: ['class', 'd', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'pathLength', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    pattern: ['class', 'externalResourcesRequired', 'height', 'id', 'patternContentUnits', 'patternTransform', 'patternUnits', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'viewBox', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    polygon: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    polyline: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    radialGradient: ['class', 'cx', 'cy', 'externalResourcesRequired', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'id', 'r', 'spreadMethod', 'style', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    rect: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    script: ['externalResourcesRequired', 'id', 'type', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    set: ['attributeName', 'attributeType', 'begin', 'dur', 'end', 'externalResourcesRequired', 'fill', 'id', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    stop: ['class', 'id', 'offset', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    style: ['id', 'media', 'title', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    svg: ['baseProfile', 'class', 'contentScriptType', 'contentStyleType', 'externalResourcesRequired', 'height', 'id', 'onabort', 'onactivate', 'onclick', 'onerror', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onresize', 'onscroll', 'onunload', 'onzoom', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'version', 'viewBox', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'zoomAndPan'],
    switch: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    symbol: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    text: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'transform', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    textPath: ['class', 'externalResourcesRequired', 'id', 'lengthAdjust', 'method', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'spacing', 'startOffset', 'style', 'systemLanguage', 'textLength', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    title: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    tref: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    tspan: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    use: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    view: ['externalResourcesRequired', 'id', 'preserveAspectRatio', 'viewBox', 'viewTarget', 'xml:base', 'xml:lang', 'xml:space', 'zoomAndPan'],
    vkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space'],
};
svgPresentationElements = {
    'a': true,
    'altGlyph': true,
    'animate': true,
    'animateColor': true,
    'circle': true,
    'clipPath': true,
    'defs': true,
    'ellipse': true,
    'feBlend': true,
    'feColorMatrix': true,
    'feComponentTransfer': true,
    'feComposite': true,
    'feConvolveMatrix': true,
    'feDiffuseLighting': true,
    'feDisplacementMap': true,
    'feFlood': true,
    'feGaussianBlur': true,
    'feImage': true,
    'feMerge': true,
    'feMorphology': true,
    'feOffset': true,
    'feSpecularLighting': true,
    'feTile': true,
    'feTurbulence': true,
    'filter': true,
    'font': true,
    'foreignObject': true,
    'g': true,
    'glyph': true,
    'glyphRef': true,
    'image': true,
    'line': true,
    'linearGradient': true,
    'marker': true,
    'mask': true,
    'missing-glyph': true,
    'path': true,
    'pattern': true,
    'polygon': true,
    'polyline': true,
    'radialGradient': true,
    'rect': true,
    'stop': true,
    'svg': true,
    'switch': true,
    'symbol': true,
    'text': true,
    'textPath': true,
    'tref': true,
    'tspan': true,
    'use': true
};
svgPresentationAttributes = {
    'alignment-baseline': true,
    'baseline-shift': true,
    'clip-path': true,
    'clip-rule': true,
    'clip': true,
    'color-interpolation-filters': true,
    'color-interpolation': true,
    'color-profile': true,
    'color-rendering': true,
    'color': true,
    'cursor': true,
    'direction': true,
    'display': true,
    'dominant-baseline': true,
    'enable-background': true,
    'fill-opacity': true,
    'fill-rule': true,
    'fill': true,
    'filter': true,
    'flood-color': true,
    'flood-opacity': true,
    'font-family': true,
    'font-size-adjust': true,
    'font-size': true,
    'font-stretch': true,
    'font-style': true,
    'font-variant': true,
    'font-weight': true,
    'glyph-orientation-horizontal': true,
    'glyph-orientation-vertical': true,
    'image-rendering': true,
    'kerning': true,
    'letter-spacing': true,
    'lighting-color': true,
    'marker-end': true,
    'marker-mid': true,
    'marker-start': true,
    'mask': true,
    'opacity': true,
    'overflow': true,
    'pointer-events': true,
    'shape-rendering': true,
    'stop-color': true,
    'stop-opacity': true,
    'stroke-dasharray': true,
    'stroke-dashoffset': true,
    'stroke-linecap': true,
    'stroke-linejoin': true,
    'stroke-miterlimit': true,
    'stroke-opacity': true,
    'stroke-width': true,
    'stroke': true,
    'text-anchor': true,
    'text-decoration': true,
    'text-rendering': true,
    'unicode-bidi': true,
    'visibility': true,
    'word-spacing': true,
    'writing-mode': true
};
svgAnalyzer = class SVGAnalyzer {
    constructor() {
    }
    isStandardSvgAttribute(nodeName, attributeName) {
        return presentationElements[nodeName] && presentationAttributes[attributeName]
            || elements[nodeName] && elements[nodeName].indexOf(attributeName) !== -1;
    }
};
const elements = svgElements;
const presentationElements = svgPresentationElements;
const presentationAttributes = svgPresentationAttributes;
const SVGAnalyzer = new (svgAnalyzer || class {
    isStandardSvgAttribute() { return false; }
});

class AttributeMap {
    constructor() {
        this.elements = Object.create(null);
        this.allElements = Object.create(null);
        this.svg = SVGAnalyzer;
        this.registerUniversal('accesskey', 'accessKey');
        this.registerUniversal('contenteditable', 'contentEditable');
        this.registerUniversal('tabindex', 'tabIndex');
        this.registerUniversal('textcontent', 'textContent');
        this.registerUniversal('innerhtml', 'innerHTML');
        this.registerUniversal('scrolltop', 'scrollTop');
        this.registerUniversal('scrollleft', 'scrollLeft');
        this.registerUniversal('readonly', 'readOnly');
        this.register('label', 'for', 'htmlFor');
        this.register('img', 'usemap', 'useMap');
        this.register('input', 'maxlength', 'maxLength');
        this.register('input', 'minlength', 'minLength');
        this.register('input', 'formaction', 'formAction');
        this.register('input', 'formenctype', 'formEncType');
        this.register('input', 'formmethod', 'formMethod');
        this.register('input', 'formnovalidate', 'formNoValidate');
        this.register('input', 'formtarget', 'formTarget');
        this.register('textarea', 'maxlength', 'maxLength');
        this.register('td', 'rowspan', 'rowSpan');
        this.register('td', 'colspan', 'colSpan');
        this.register('th', 'rowspan', 'rowSpan');
        this.register('th', 'colspan', 'colSpan');
    }
    register(elementName, attributeName, propertyName) {
        elementName = elementName.toLowerCase();
        attributeName = attributeName.toLowerCase();
        const element = this.elements[elementName] = (this.elements[elementName] || Object.create(null));
        element[attributeName] = propertyName;
    }
    registerUniversal(attributeName, propertyName) {
        attributeName = attributeName.toLowerCase();
        this.allElements[attributeName] = propertyName;
    }
    map(elementName, attributeName) {
        if (this.svg.isStandardSvgAttribute(elementName, attributeName)) {
            return attributeName;
        }
        elementName = elementName.toLowerCase();
        attributeName = attributeName.toLowerCase();
        const element = this.elements[elementName];
        if (element !== undefined && attributeName in element) {
            return element[attributeName];
        }
        if (attributeName in this.allElements) {
            return this.allElements[attributeName];
        }
        if (/(?:^data-)|(?:^aria-)|:/.test(attributeName)) {
            return attributeName;
        }
        return camelCase(attributeName);
    }
}
AttributeMap.instance = new AttributeMap();

class SyntaxInterpreter {
    constructor(parser, bindingLanguage, attributeMap) {
        this.parser = parser;
        this.bindingLanguage = bindingLanguage;
        this.attributeMap = attributeMap;
    }
    interpret(element, info, targetIndex, elementResource, factory, auModule) {
        if (info.command && info.command in this) {
            return this[info.command](element, info, targetIndex, elementResource, factory, auModule);
        }
        return this.handleUnknownCommand(element, info, targetIndex);
    }
    handleUnknownCommand(element, info, targetIndex) {
        console.warn('Unknown binding command.', info);
        return null;
    }
    determineDefaultBindingMode(element, attrName, elementResource, factory, auModule) {
        let tagName = element.tagName.toLowerCase();
        if (tagName === 'input' && (attrName === 'value' || attrName === 'files') && element.type !== 'checkbox' && element.type !== 'radio'
            || tagName === 'input' && attrName === 'checked' && (element.type === 'checkbox' || element.type === 'radio')
            || (tagName === 'textarea' || tagName === 'select') && attrName === 'value'
            || (attrName === 'textcontent' || attrName === 'innerhtml') && element.contentEditable === 'true'
            || attrName === 'scrolltop'
            || attrName === 'scrollleft') {
            return bindingMode.twoWay;
        }
        if (!elementResource) {
            return bindingMode.toView;
        }
        let bindable = elementResource.getBindable(attrName);
        if (bindable) {
            return bindable.defaultBindingMode === null || bindable.defaultBindingMode === undefined
                ? bindingMode.toView
                : bindable.defaultBindingMode;
        }
        return bindingMode.oneWay;
    }
    bind(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('Command [bind] used without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, info.defaultBindingMode === undefined || info.defaultBindingMode === null
            ? this.determineDefaultBindingMode(el, info.attrName, elRes, factory, auModule)
            : info.defaultBindingMode, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
    trigger(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('Command [trigger] used without attribue name or value.');
            return null;
        }
        return new ListenerBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, delegationStrategy.none);
    }
    capture(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('Command [capture] used without attribue name or value.');
            return null;
        }
        return new ListenerBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, delegationStrategy.capturing);
    }
    delegate(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('Command [delegate] used without attribue name or value.');
            return null;
        }
        return new ListenerBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, delegationStrategy.bubbling);
    }
    'two-way'(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('explicit [.two-way] command without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, bindingMode.twoWay, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
    'to-view'(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('explicit [.to-view] command without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, bindingMode.toView, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
    'one-way'(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('explicit [.one-way] command without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, bindingMode.toView, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
    'from-view'(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('explicit [.from-view] command without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, bindingMode.fromView, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
    'one-time'(el, info, targetIndex, elRes, factory, auModule) {
        if (!info.attrName || !info.attrValue) {
            console.error('explicit [.one-time] command without attribue name or value.');
            return null;
        }
        let bindable = elRes ? elRes.getBindable(info.attrName) : null;
        return new PropertyBinding(this.parser.getOrCreateAstRecord(info.attrValue), targetIndex, info.attrName, bindingMode.oneTime, bindable ? true : false, bindable ? factory.lastBehaviorIndex : undefined);
    }
}
SyntaxInterpreter.inject = [Parser, 'IBindingLanguage', AttributeMap];

let info = {};
class TemplatingBindingLanguage {
    constructor(parser, attributeMap) {
        this.parser = parser;
        this.attributeMap = attributeMap;
        this.syntaxInterpreter = new SyntaxInterpreter(parser, this, attributeMap);
        this.emptyStringExpression = parser.parse('\'\'');
    }
    inspectAttribute(element, attrName, attrValue, targetIndex, elementResource, templateFactory, auModule) {
        let parts = attrName.split('.');
        info.defaultBindingMode = undefined;
        if (parts.length === 2) {
            info.attrName = parts[0].trim();
            info.attrValue = attrValue;
            info.command = parts[1].trim();
            if (info.command === 'ref') {
                return new RefBinding(this.parser.getOrCreateAstRecord(attrValue), targetIndex, info.attrName);
            }
            else {
                let htmlAttrName = hyphenate(attrName);
                if (elementResource !== null) {
                    let elProperty = elementResource.getBindable(htmlAttrName);
                }
                let attrResource = auModule.getCustomAttribute(htmlAttrName);
                return this.syntaxInterpreter.interpret(element, info, targetIndex, elementResource, templateFactory, auModule);
            }
        }
        else if (attrName === 'ref') {
            return new RefBinding(this.parser.getOrCreateAstRecord(attrValue), targetIndex, ELEMENT_REF_KEY);
        }
        else {
            info.attrName = attrName;
            info.attrValue = attrValue;
            info.command = undefined;
            const templateLiteral = this.parseInterpolation(attrValue);
            if (templateLiteral === null) {
                return null;
            }
            else {
                return new TextBinding(Parser.addAst(attrValue, templateLiteral), targetIndex);
            }
        }
    }
    inspectTextContent(value) {
        let templateLiteral = this.parseInterpolation(value);
        if (templateLiteral === null) {
            return null;
        }
        return templateLiteral;
    }
    parseInterpolation(value) {
        let i = value.indexOf('${', 0);
        let ii = value.length;
        let char;
        let pos = 0;
        let open = 0;
        let quote = null;
        let interpolationStart;
        let parts;
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
                    }
                    else if (quote === char) {
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
                }
                else if (char === '}') {
                    open--;
                }
            } while (open > 0 && i < ii);
            if (open === 0) {
                parts = parts || [];
                if (value[interpolationStart - 1] === '\\' && value[interpolationStart - 2] !== '\\') {
                    parts[partIndex] = new LiteralString(value.substring(pos, interpolationStart - 1) + value.substring(interpolationStart, i));
                    partIndex++;
                    parts[partIndex] = this.emptyStringExpression;
                    partIndex++;
                }
                else {
                    parts[partIndex] = new LiteralString(value.substring(pos, interpolationStart));
                    partIndex++;
                    parts[partIndex] = this.parser.parse(value.substring(interpolationStart + 2, i - 1));
                    partIndex++;
                }
                pos = i;
                i = value.indexOf('${', i);
            }
            else {
                break;
            }
        }
        if (partIndex === 0) {
            return null;
        }
        parts[partIndex] = new LiteralString(value.substr(pos));
        return new TemplateLiteral(parts);
    }
}
TemplatingBindingLanguage.inject = [Parser, AttributeMap];

class AureliaCompiler {
    constructor(fileUtils) {
        let container = this.container = new Container().makeGlobal();
        this.parser = container.get(Parser);
        container.registerInstance('Parser', this.parser);
        container.registerInstance('IFileUtils', fileUtils);
        let bindingLanguage = container.get(TemplatingBindingLanguage);
        container.registerInstance('IBindingLanguage', bindingLanguage);
        let viewCompiler = this.viewCompiler = container.get(ViewCompiler);
        container.registerInstance('IViewCompiler', viewCompiler);
        let moduleCompiler = this.moduleCompiler = container.get(AureliaModuleCompiler);
        container.registerInstance('IAureliaModuleCompiler', moduleCompiler);
        viewCompiler.moduleCompiler = moduleCompiler;
    }
    forgeGlobalResourceModule() {
        let $module = new AureliaResourceModule('src/framework/resources/index', '', this.moduleCompiler);
        $module.global = true;
        $module.addCustomAttribute(new AttributeResource($module, 'If', {
            'condition': {
                name: 'condition',
                defaultBindingMode: bindingMode.toView,
                attribute: 'condition',
                primaryProperty: true,
                type: 'boolean',
            }
        }, {}, {}));
        $module.addCustomAttribute(new AttributeResource($module, 'Else', {
            'condition': {
                name: 'condition',
                attribute: 'condition',
                defaultBindingMode: bindingMode.toView,
                primaryProperty: false,
                type: 'boolean'
            }
        }, {}, {}));
        return $module;
    }
    start({ entry, outputDir, globalResources = 'src/framework/resources/index' }) {
        this.config = {
            entry,
            outputDir,
            globalResources
        };
        AureliaResourceModule.globalModule = this.forgeGlobalResourceModule();
        return this.moduleCompiler.compile(entry);
    }
    emitAll() {
        if (!this.config || !this.config.outputDir) {
            throw new Error('Invalid emit target. Directory not specified.');
        }
        return this.moduleCompiler.emitAll(this.config.outputDir);
    }
}

exports.AureliaCompiler = AureliaCompiler;
exports.Parser = Parser;
