import vscode from 'vscode'
import path from 'path'

export let doc: vscode.TextDocument
export let editor: vscode.TextEditor
export let documentEol: string
export let platformEol: string

export async function sleep(ms: number): Promise<NodeJS.Timeout> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Try requiring
 */
function tryRequire(path: string): any {
  try {
    return require(path)
  } catch (err) {
    console.error(err)
    return 
  }
}

/**
 * Activates the vscode.prisma extension
 * @todo check readiness of the server instead of timeout
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
  // The extensionId is `publisher.name` from package.json
  const pj = tryRequire('../../../package.json')
  if (!pj) {
    return
  }
  const ext = vscode.extensions.getExtension(pj.publisher + '.' + pj.name)
  if (!ext) {
    console.error('Failed to get extension.')
    return
  }
  await ext.activate()
  try {
    doc = await vscode.workspace.openTextDocument(docUri)
    editor = await vscode.window.showTextDocument(doc)
    await sleep(2500) // Wait for server activation
  } catch (e) {
    console.error(e)
  }
}

export function toRange(
  sLine: number,
  sChar: number,
  eLine: number,
  eChar: number,
): vscode.Range {
  const start = new vscode.Position(sLine, sChar)
  const end = new vscode.Position(eLine, eChar)
  return new vscode.Range(start, end)
}

export const getDocPath = (p: string): string => {
  return path.resolve(__dirname, '../../testFixture', p)
}
export const getDocUri = (p: string): vscode.Uri => {
  return vscode.Uri.file(getDocPath(p))
}

export async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  )
  return editor.edit((eb) => eb.replace(all, content))
}
