import {
  TextDocuments,
  DocumentFormattingParams,
  TextEdit,
  Range,
  Location,
  DeclarationParams,
  CompletionParams,
  CompletionList,
  CompletionItem,
  Position,
  HoverParams,
  Hover,
} from 'vscode-languageserver'
import * as util from './util'
import { fullDocumentRange } from './provider'
import { TextDocument } from 'vscode-languageserver-textdocument'
import format from './format'
import {
  getSuggestionsForAttributes,
  getSuggestionsForTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideAttributes,
} from './completions'
import { start } from 'repl'

function getCurrentLine(document: TextDocument, line: number) {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: 9999 },
  })
}

function convertDocumentTextToTrimmedLineArray(
  document: TextDocument,
): Array<string> {
  return Array(document.lineCount)
    .fill(0)
    .map((_, i) => getCurrentLine(document, i).trim())
}

function isFirstInsideBlock(position: Position, currentLine: string): boolean {
  if (currentLine.trim().length === 0) {
    return true
  }

  const stringTillPosition = currentLine.slice(0, position.character)
  const matchArray = /\w+/.exec(stringTillPosition)

  if (!matchArray) {
    return true
  }
  return (
    matchArray.length === 1 &&
    matchArray.index !== undefined &&
    stringTillPosition.length - matchArray.index - matchArray[0].length === 0
  )
}

export function getWordAtPosition(
  document: TextDocument,
  position: Position,
): string {
  const currentLine = getCurrentLine(document, position.line)
  const stringTillPosition = currentLine.slice(0, position.character)
  if (stringTillPosition.endsWith('@@')) {
    return '@@'
  }
  if (stringTillPosition.endsWith('@')) {
    return '@'
  }
  // search for the word's beginning and end
  const beginning: number = currentLine
    .slice(0, position.character + 1)
    .search(/\S+$/)
  const end: number = currentLine.slice(position.character).search(/\W/)
  if (end < 0) {
    return ''
  }
  return currentLine.slice(beginning, end + position.character)
}

export class MyBlock {
  type: string
  start: Position
  end: Position
  name: string

  constructor(type: string, start: Position, end: Position, name: string) {
    this.type = type
    this.start = start
    this.end = end
    this.name = name
  }
}

function getBlockAtPosition(
  line: number,
  lines: Array<string>,
): MyBlock | void {
  let blockType = ''
  let blockName = ''
  let blockStart: Position = Position.create(0, 0)
  let blockEnd: Position = Position.create(0, 0)
  // get block beginning
  let reachedLine = false
  for (const [key, item] of lines.reverse().entries()) {
    const actualIndex = lines.length - 1 - key
    if (actualIndex === line) {
      reachedLine = true
    }
    if (!reachedLine) {
      continue
    }
    if (item.includes('{')) {
      const index = item.search(/\s+/)
      blockType = ~index ? item.slice(0, index) : item
      blockName = item.slice(blockType.length, item.length - 2).trim()
      blockStart = Position.create(actualIndex, 0)
      break
    }
    // not inside a block
    if (item.includes('}')) {
      return
    }
  }
  reachedLine = false
  // get block ending
  for (const [key, item] of lines.reverse().entries()) {
    if (key === line) {
      reachedLine = true
    }
    if (!reachedLine) {
      continue
    }
    if (item.includes('}')) {
      blockEnd = Position.create(key, 1)
      return new MyBlock(blockType, blockStart, blockEnd, blockName)
    }
  }
  return
}

function getModelOrEnumBlock(
  blockName: string,
  lines: string[],
): MyBlock | void {
  // get start position of model type
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(blockName)) ||
        (line.includes('enum') && line.includes(blockName))
      ) {
        return index
      }
    })
    .filter((index) => index !== undefined) as number[]

  if (results.length === 0) {
    return
  }

  const foundBlocks: MyBlock[] = results
    .map((result) => {
      const block = getBlockAtPosition(result, lines)
      if (block && block.name === blockName) {
        return block
      }
    })
    .filter((block) => block !== undefined) as MyBlock[]

  if (foundBlocks.length !== 1) {
    return
  }

  if (!foundBlocks[0]) {
    return
  }

  return foundBlocks[0]
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(
  documents: TextDocuments<TextDocument>,
  params: DeclarationParams,
): Location | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const document = documents.get(textDocument.uri)

  if (!document) {
    return
  }

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrEnumBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const startPosition = {
    line: foundBlock.start.line,
    character: foundBlock.start.character,
  }
  const endPosition = {
    line: foundBlock.end.line,
    character: foundBlock.end.character,
  }

  return {
    uri: textDocument.uri,
    range: Range.create(startPosition, endPosition),
  }
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export async function handleDocumentFormatting(
  params: DocumentFormattingParams,
  documents: TextDocuments<TextDocument>,
  onError?: (errorMessage: string) => void,
): Promise<TextEdit[]> {
  const options = params.options
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return []
  }
  const binPath = await util.getBinPath()
  return format(
    binPath,
    options.tabSize,
    document.getText(),
    onError,
  ).then((formatted) => [
    TextEdit.replace(fullDocumentRange(document), formatted),
  ])
}

export function handleHoverRequest(
  documents: TextDocuments<TextDocument>,
  params: HoverParams,
): Hover | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const document = documents.get(textDocument.uri)

  if (!document) {
    return
  }

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrEnumBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const commentLine = foundBlock.start.line - 1
  const docComments = document.getText({
    start: { line: commentLine, character: 0 },
    end: { line: commentLine, character: 9999999 },
  })
  if (!docComments.startsWith('///')) {
    return
  }

  return {
    contents: docComments.slice(4),
  }
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  documents: TextDocuments<TextDocument>,
  params: CompletionParams,
): CompletionList | undefined {
  const context = params.context
  if (!context) {
    return
  }

  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return
  }
  const lines = convertDocumentTextToTrimmedLineArray(document)

  const foundBlock = getBlockAtPosition(params.position.line, lines)
  if (!foundBlock) {
    return getSuggestionForBlockTypes(lines)
  }

  if (
    isFirstInsideBlock(
      params.position,
      getCurrentLine(document, params.position.line),
    )
  ) {
    return getSuggestionForFirstInsideBlock(
      foundBlock.type,
      lines,
      params.position,
      foundBlock,
      document,
    )
  }

  // Completion was triggered by a triggerCharacter
  if (context.triggerKind === 2) {
    switch (context.triggerCharacter) {
      case '@':
        return getSuggestionsForAttributes(
          foundBlock.type,
          params.position,
          document,
          lines[params.position.line],
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[params.position.line],
        )
    }
  }

  if (foundBlock.type === 'model') {
    const symbolBeforePosition = document.getText({
      start: {
        line: params.position.line,
        character: params.position.character - 1,
      },
      end: { line: params.position.line, character: params.position.character },
    })
    const currentLine = lines[params.position.line]
    const wordsBeforePosition: string[] = currentLine
      .slice(0, params.position.character - 1)
      .trim()
      .split(/\s+/)

    if (currentLine.includes('(')) {
      return getSuggestionsForInsideAttributes(
        lines,
        params.position,
        foundBlock,
      )
    }

    // check if type
    if (
      wordsBeforePosition.length < 2 ||
      (wordsBeforePosition.length === 2 && symbolBeforePosition !== ' ')
    ) {
      return getSuggestionsForTypes(foundBlock, lines)
    }
    return getSuggestionsForAttributes(
      foundBlock.type,
      params.position,
      document,
      lines[params.position.line],
    )
  }
}

/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
export function handleCompletionResolveRequest(
  item: CompletionItem,
): CompletionItem {
  return item
}
