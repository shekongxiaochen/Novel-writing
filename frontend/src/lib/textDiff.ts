export type DiffOp = 'equal' | 'insert' | 'delete'

export type DiffSegment = {
  op: DiffOp
  text: string
  startInNew?: number
  endInNew?: number
}

export function computeLineDiff(oldText: string, newText: string): DiffSegment[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const ops = myersDiff(oldLines, newLines)

  const segments: DiffSegment[] = []
  let newOffset = 0

  for (const op of ops) {
    if (op.op === 'equal') {
      const text = op.lines.join('\n')
      segments.push({ op: 'equal', text, startInNew: newOffset, endInNew: newOffset + text.length })
      newOffset += text.length + 1
    } else if (op.op === 'insert') {
      const text = op.lines.join('\n')
      segments.push({ op: 'insert', text, startInNew: newOffset, endInNew: newOffset + text.length })
      newOffset += text.length + 1
    } else if (op.op === 'delete') {
      const text = op.lines.join('\n')
      segments.push({ op: 'delete', text })
    }
  }

  return segments
}

type RawOp = { op: 'equal' | 'insert' | 'delete'; lines: string[] }

function myersDiff(oldLines: string[], newLines: string[]): RawOp[] {
  const n = oldLines.length
  const m = newLines.length
  const max = n + m

  if (max === 0) return []
  if (n === 0) return [{ op: 'insert', lines: newLines }]
  if (m === 0) return [{ op: 'delete', lines: oldLines }]

  const vSize = 2 * max + 1
  const v = new Array(vSize).fill(0)
  const trace: number[][] = []

  for (let d = 0; d <= max; d++) {
    trace.push([...v])
    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + max
      let x: number
      if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
        x = v[kIdx + 1]
      } else {
        x = v[kIdx - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++
        y++
      }
      v[kIdx] = x
      if (x >= n && y >= m) {
        return buildResult(trace, oldLines, newLines, d, max)
      }
    }
  }

  return [{ op: 'delete', lines: oldLines }, { op: 'insert', lines: newLines }]
}

function buildResult(
  trace: number[][],
  oldLines: string[],
  newLines: string[],
  d: number,
  max: number,
): RawOp[] {
  const n = oldLines.length
  const m = newLines.length
  let x = n
  let y = m

  const edits: Array<{ op: 'equal' | 'insert' | 'delete'; oldIdx: number; newIdx: number }> = []

  for (let step = d; step > 0; step--) {
    const v = trace[step - 1]
    const k = x - y
    const kIdx = k + max

    let prevK: number
    if (k === -step || (k !== step && v[kIdx - 1] < v[kIdx + 1])) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }

    const prevX = v[prevK + max]
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      x--
      y--
      edits.unshift({ op: 'equal', oldIdx: x, newIdx: y })
    }

    if (x > prevX) {
      x--
      edits.unshift({ op: 'delete', oldIdx: x, newIdx: y })
    } else if (y > prevY) {
      y--
      edits.unshift({ op: 'insert', oldIdx: x, newIdx: y })
    }
  }

  while (x > 0 && y > 0) {
    x--
    y--
    edits.unshift({ op: 'equal', oldIdx: x, newIdx: y })
  }

  const ops: RawOp[] = []
  for (const edit of edits) {
    const last = ops[ops.length - 1]
    if (edit.op === 'equal') {
      const line = newLines[edit.newIdx]
      if (last && last.op === 'equal') last.lines.push(line)
      else ops.push({ op: 'equal', lines: [line] })
    } else if (edit.op === 'delete') {
      const line = oldLines[edit.oldIdx]
      if (last && last.op === 'delete') last.lines.push(line)
      else ops.push({ op: 'delete', lines: [line] })
    } else {
      const line = newLines[edit.newIdx]
      if (last && last.op === 'insert') last.lines.push(line)
      else ops.push({ op: 'insert', lines: [line] })
    }
  }

  return ops
}
