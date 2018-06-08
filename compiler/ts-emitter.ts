import * as ts from 'typescript';
import { ICodeEmitter } from "./interfaces";

export class CodeEmitter implements ICodeEmitter {

  private emptyFile: ts.SourceFile = ts.createSourceFile('', '', ts.ScriptTarget.Latest);
  private printer: ts.Printer = ts.createPrinter({
    removeComments: false,
  });

  emit(node: ts.Node): string {
    return this.printer.printNode(ts.EmitHint.Unspecified, node, this.emptyFile);
  }
}
