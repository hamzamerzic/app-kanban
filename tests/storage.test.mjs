import test from 'node:test'
import assert from 'node:assert/strict'

import {
  boardPath,
  casMutate,
  migrateLegacy,
  loadUi,
  normalizeBoard,
  saveLastBoardId,
  seedFirstBoard,
} from '../storage.js'

test.afterEach(() => { delete globalThis.window })

test('normalization repairs known fields while preserving future fields', () => {
  const doc = {
    title: 42,
    columns: [null, { id: 'c1', futureColumn: true }],
    cards: {
      card: {
        title: 'Card',
        due: 'not-a-date',
        checklist: [{ id: 'item', text: 7, done: 'yes', futureItem: true }, null],
        futureCard: true,
      },
      empty: { title: 'Defaults' },
    },
    future: { kept: true },
  }
  const normalized = normalizeBoard(doc)
  assert.equal(normalized, doc)
  assert.equal(normalized.v, 1)
  assert.equal(normalized.title, 'Board')
  assert.equal(normalized.columns.length, 1)
  assert.deepEqual(normalized.columns[0].cardIds, [])
  assert.equal(normalized.columns[0].name, 'List')
  assert.equal(normalized.columns[0].color, null)
  assert.equal(normalized.cards.card.due, '')
  assert.equal(normalized.cards.card.assignee, '')
  assert.deepEqual(normalized.cards.card.checklist, [
    { id: 'item', text: '', done: false, futureItem: true },
  ])
  assert.equal(normalized.cards.card.futureCard, true)
  assert.equal(normalized.cards.empty.due, '')
  assert.deepEqual(normalized.cards.empty.checklist, [])
  assert.deepEqual(normalized.future, { kept: true })
  assert.equal(normalized.columns[0].futureColumn, true)
  assert.equal(normalizeBoard([]), null)
})

test('normalization defaults status colors by initial position and assignees additively', () => {
  const doc = normalizeBoard({
    v: 1,
    title: 'Colors',
    columns: Array.from({ length: 7 }, (_, index) => ({ id: String(index), cardIds: [] })),
    cards: { kept: { assignee: 'Ada Lovelace', due: '', checklist: [], future: true } },
  })
  assert.deepEqual(doc.columns.map(column => column.color), [null, 'blue', 'green', 'amber', 'purple', 'pink', 'amber'])
  assert.equal(doc.cards.kept.assignee, 'Ada Lovelace')
  assert.equal(doc.cards.kept.future, true)
})

test('ui storage remembers the last board with conflict-safe additive writes', async () => {
  const writes = []
  globalThis.window = { mobius: { storage: {
    async get(path) {
      assert.equal(path, 'ui.json')
      return { lastBoardId: 'old', future: 'kept' }
    },
    async getWithVersion(path) {
      assert.equal(path, 'ui.json')
      return { value: { lastBoardId: 'old', future: 'kept' }, version: 'u1' }
    },
    async durableWrite(path, value, options) { writes.push({ path, value, options }) },
  } } }
  assert.deepEqual(await loadUi(), { lastBoardId: 'old', future: 'kept' })
  await saveLastBoardId('next')
  assert.deepEqual(writes[0], {
    path: 'ui.json',
    value: { lastBoardId: 'next', future: 'kept' },
    options: { ifMatch: 'u1' },
  })
})

test('CAS mutation reapplies an operation to the freshest board after conflict', async () => {
  const reads = [
    { value: { v: 1, title: 'stale', columns: [], cards: {} }, version: 'v1' },
    { value: { v: 1, title: 'concurrent', columns: [], cards: {}, future: true }, version: 'v2' },
  ]
  const writes = []
  globalThis.window = { mobius: { storage: {
    async getWithVersion(path) {
      assert.equal(path, boardPath('b1'))
      return reads.shift()
    },
    async durableWrite(path, value, options) {
      writes.push({ path, value: structuredClone(value), options })
      if (writes.length === 1) throw Object.assign(new Error('conflict'), { code: 'conflict' })
    },
  } } }

  const landed = await casMutate('b1', board => { board.title += ' + edit'; return board })
  assert.equal(writes.length, 2)
  assert.deepEqual(writes[1].options, { ifMatch: 'v2' })
  assert.equal(landed.title, 'concurrent + edit')
  assert.equal(landed.future, true)
})

test('CAS mutation never resurrects a deleted board', async () => {
  let writes = 0
  globalThis.window = { mobius: { storage: {
    async getWithVersion() { return { value: null, version: null } },
    async durableWrite() { writes += 1 },
  } } }
  assert.equal(await casMutate('gone', board => board), null)
  assert.equal(writes, 0)
})

test('first-run seed treats a competing creator as success', async () => {
  globalThis.window = { mobius: { storage: {
    async durableWrite(path, value, options) {
      assert.equal(path, boardPath('welcome'))
      assert.equal(value.id, 'welcome')
      assert.deepEqual(options, { ifNoneMatch: true })
      throw Object.assign(new Error('already created'), { code: 'conflict' })
    },
  } } }
  await seedFirstBoard()
})

test('legacy migration keeps a deterministic id and removes the old path only after save', async () => {
  const calls = []
  globalThis.window = { mobius: { storage: {
    async get(path) {
      calls.push(['get', path])
      return { title: 'Legacy', columns: [], cards: {}, future: 'kept' }
    },
    async durableWrite(path, value, options) {
      calls.push(['write', path, structuredClone(value), options])
    },
    async remove(path) { calls.push(['remove', path]) },
  } } }
  await migrateLegacy()
  assert.equal(calls[1][1], boardPath('migrated-v0'))
  assert.equal(calls[1][2].future, 'kept')
  assert.deepEqual(calls[1][3], { ifNoneMatch: true })
  assert.deepEqual(calls.at(-1), ['remove', 'board.json'])
})
