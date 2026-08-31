import test from 'node:test'
import assert from 'node:assert/strict'

import { boardAccess, invitationKey } from '../domain.js'

test('local boards remain writable offline because storage queues their writes', () => {
  assert.deepEqual(boardAccess(null, false), {
    canWrite: true,
    status: 'Offline — changes will sync',
  })
})

test('shared boards become read-only while offline instead of promising lost writes', () => {
  assert.deepEqual(boardAccess({ role: 'editor' }, false), {
    canWrite: false,
    status: 'Offline — shared board is read-only',
  })
})

test('viewer membership never exposes a writable board', () => {
  assert.deepEqual(boardAccess({ role: 'viewer' }, true), {
    canWrite: false,
    status: 'View only',
  })
  assert.deepEqual(boardAccess({ role: 'editor' }, true), {
    canWrite: true,
    status: '',
  })
})

test('invitation identity includes both host and object id', () => {
  assert.notEqual(
    invitationKey({ host: 'one.example', id: 'same' }),
    invitationKey({ host: 'two.example', id: 'same' }),
  )
})
