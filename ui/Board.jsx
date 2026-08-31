import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Trash, ChevronLeft, Share } from '@openai/apps-sdk-ui/components/Icon'
import { uid, subscribeBoard, getBoard, casMutate, boardPath } from '../storage.js'
import { pullShared, pushSharedOp, inviteByHandle, getMembers, revokeMember, shareBoard } from '../sync.js'
import { boardAccess } from '../domain.js'

export const LABELS = {
  none: 'transparent',
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
}

function Card({ card, lifted, onOpen, onDragStart, canWrite }) {
  return (
    <div
      className={`kb-card${lifted ? ' kb-lifted' : ''}${canWrite ? '' : ' kb-readonly'}`}
      data-card-id={card.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card.id) } }}
      onPointerDown={canWrite ? e => onDragStart(e, card.id) : undefined}
    >
      {card.label && card.label !== 'none' && (
        <div className="kb-label" style={{ background: LABELS[card.label] || LABELS.none }} />
      )}
      <div className="kb-card-title">{card.title}</div>
      {card.notes ? <div className="kb-card-notes">{card.notes}</div> : null}
    </div>
  )
}

function ShareSheet({ board, boardId, share, onShared, onClose }) {
  const [handle, setHandle] = useState('')
  const [role, setRole] = useState('editor')
  const [members, setMembers] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // {kind: 'ok'|'warn'|'error', text}
  const hosted = !!share?.hosted

  useEffect(() => {
    if (hosted) {
      getMembers(share.oid).then(o => setMembers(o.members || {})).catch(() => setMembers(null))
    }
  }, [hosted, share?.oid])

  const start = async () => {
    setBusy(true); setNotice(null)
    try {
      const entry = await shareBoard(boardId, board)
      onShared({ ...entry, hosted: true })
    } catch (e) {
      setNotice({ kind: 'error', text: String(e?.message || e) })
    }
    setBusy(false)
  }

  const invite = async () => {
    const who = handle.trim()
    if (!who || busy) return
    setBusy(true); setNotice(null)
    try {
      const res = await inviteByHandle(share.oid, who, role)
      setMembers(ms => ({
        ...(ms || {}),
        [res.host]: { role: res.role, name: who, pending: true },
      }))
      setHandle('')
      setNotice(res.delivery === 'delivered'
        ? { kind: 'ok', text: `Invited — it's waiting on their Möbius.` }
        : { kind: 'warn', text: `Invited, but their Möbius couldn't be reached right now. They'll be let in automatically when their app connects.` })
    } catch (e) {
      setNotice({ kind: 'error', text: String(e?.message || e) })
    }
    setBusy(false)
  }

  return (
    <>
      <div className="kb-scrim" onClick={onClose} />
      <div className="kb-sheet" role="dialog" aria-label="Share board">
        <div className="kb-sheet-grab" />
        {!share && (
          <>
            <h3>Share this board</h3>
            <div className="kb-empty" style={{ textAlign: 'left', padding: 0 }}>
              Sharing keeps the board on your Möbius and lets people you invite
              edit it live from their own Möbius.
            </div>
            <button className="kb-btn kb-btn-primary" disabled={busy} onClick={start}>
              Turn on sharing
            </button>
          </>
        )}
        {share && hosted && (
          <>
            <div>
              <h3>Invite someone</h3>
              <input
                className="kb-input"
                style={{ marginTop: 8 }}
                placeholder="@handle or handle@their-mobius-host"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') invite() }}
                aria-label="Invite handle"
              />
              <div className="kb-chips" style={{ marginTop: 8 }}>
                <button className={`kb-chip${role === 'editor' ? ' kb-on' : ''}`} onClick={() => setRole('editor')}>Can edit</button>
                <button className={`kb-chip${role === 'viewer' ? ' kb-on' : ''}`} onClick={() => setRole('viewer')}>View only</button>
                <button className="kb-btn kb-btn-primary" disabled={busy || !handle.trim()} onClick={invite}>Invite</button>
              </div>
            </div>
            <div>
              <h3>People</h3>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members === null && <div className="kb-empty">Loading…</div>}
                {members && Object.entries(members).map(([host, m]) => (
                  <div key={host} className="kb-sheet-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>
                      {m.name || host}{' '}
                      <span className="kb-sub">
                        · {host === share.host ? 'you' : m.pending ? `invited · ${m.role}` : m.role}
                      </span>
                    </span>
                    {host !== share.host && (
                      <button className="kb-btn kb-btn-quiet kb-danger" onClick={async () => {
                        try { await revokeMember(share.oid, host); setMembers(ms => { const n = { ...ms }; delete n[host]; return n }) } catch (e) { setNotice({ kind: 'error', text: String(e?.message || e) }) }
                      }}>{m.pending ? 'Cancel invite' : 'Remove'}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {share && !hosted && (
          <div>
            <h3>Shared board</h3>
            <div className="kb-empty" style={{ textAlign: 'left' }}>
              This board lives on {share.host}. You joined as {share.role === 'viewer' ? 'a viewer' : 'an editor'}.
            </div>
          </div>
        )}
        {notice && (
          <div className="kb-empty" style={{ color: notice.kind === 'error' ? '#ef4444' : notice.kind === 'warn' ? '#f59e0b' : '#10b981' }}>
            {notice.text}
          </div>
        )}
        <button className="kb-btn kb-btn-primary" onClick={onClose}>Done</button>
      </div>
    </>
  )
}

function Composer({ onAdd, onClose }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  const submit = () => {
    const t = text.trim()
    if (t) onAdd(t)
    setText('')
    if (!t) onClose()
  }
  return (
    <div className="kb-composer">
      <textarea
        ref={ref}
        className="kb-input"
        rows={2}
        placeholder="Card title…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="kb-composer-row">
        <button className="kb-btn kb-btn-primary" onClick={submit}>Add card</button>
        <button className="kb-btn kb-btn-quiet" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export default function Board({ boardId, onBack, online, share, onShared }) {
  const [board, setBoard] = useState(null)
  const [composerCol, setComposerCol] = useState(null)
  const [openCardId, setOpenCardId] = useState(null)
  const [confirmDeleteCol, setConfirmDeleteCol] = useState(null)
  const [drag, setDrag] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [syncNote, setSyncNote] = useState('')

  const boardRef = useRef(null)
  const pendingRef = useRef(0)
  const writeChain = useRef(Promise.resolve())
  const dragRef = useRef(null)
  const rectsRef = useRef(null)
  const versionRef = useRef(-1)
  const shareRef = useRef(share)
  const onlineRef = useRef(online)
  boardRef.current = board
  shareRef.current = share
  onlineRef.current = online

  useEffect(() => {
    let unsub = null
    let alive = true
    getBoard(boardId).then(doc => {
      if (!alive) return
      if (doc) setBoard(doc)
      unsub = subscribeBoard(boardId, v => {
        if (!v) return
        if (pendingRef.current > 0) return
        if (dragRef.current) return
        setBoard(v)
      })
    }).catch(err => {
      window.mobius?.signal?.('error', { message: String(err?.message || err), source: 'board-load' })
    })
    return () => { alive = false; unsub?.() }
  }, [boardId])

  // Shared boards: poll the shared object and fold newer documents in.
  useEffect(() => {
    if (!share) return undefined
    let alive = true
    let pulling = false
    versionRef.current = -1
    const tick = async () => {
      if (!alive || pulling || document.hidden) return
      pulling = true
      try {
        const state = await pullShared(share, versionRef.current)
        if (!alive) return
        if (state.version < versionRef.current) return
        versionRef.current = state.version
        if (state.doc) {
          window.mobius?.storage?.set(boardPath(boardId), state.doc).catch(() => {})
          if (pendingRef.current === 0 && !dragRef.current) setBoard(state.doc)
        }
        setSyncNote('')
      } catch (e) {
        setSyncNote('Sync unavailable — showing your last copy')
      } finally {
        pulling = false
      }
    }
    tick()
    const t = setInterval(tick, 3000)
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [share, boardId])

  const mutate = useCallback(op => {
    const entry = shareRef.current
    if (!boardAccess(entry, onlineRef.current).canWrite) return false
    const current = boardRef.current
    if (!current) return false
    const before = structuredClone(current)
    const optimistic = op(structuredClone(current)) || current
    boardRef.current = optimistic
    setBoard(optimistic)
    pendingRef.current += 1
    const onErr = e =>
      window.mobius?.signal?.('error', { message: String(e?.message || e), source: 'save' })
    let settled = null
    writeChain.current = writeChain.current.catch(() => {}).then(async () => {
      if (entry) {
        const landed = await pushSharedOp(entry, op, onErr)
        if (landed) {
          versionRef.current = landed.version
          await window.mobius?.storage?.set(boardPath(boardId), landed.doc).catch(() => {})
          settled = landed.doc
        } else {
          settled = before
        }
        return
      }
      await casMutate(boardId, op, onErr)
    }).finally(() => {
      pendingRef.current -= 1
      if (pendingRef.current === 0) {
        if (entry) {
          if (settled && !dragRef.current) {
            boardRef.current = settled
            setBoard(settled)
          }
        } else {
          getBoard(boardId).then(v => {
            if (v && pendingRef.current === 0 && !dragRef.current) setBoard(v)
          }).catch(() => {})
        }
      }
    })
    return true
  }, [boardId])

  const addCard = (colId, title) => {
    const id = uid()
    const queued = mutate(b => {
      const col = b.columns.find(c => c.id === colId)
      if (!col) return b
      b.cards[id] = { id, title, notes: '', label: 'none', createdAt: new Date().toISOString() }
      col.cardIds.push(id)
      return b
    })
    if (queued) window.mobius?.signal?.('item_created', { type: 'card' })
  }

  const updateCard = (cardId, patch) => {
    mutate(b => {
      if (!b.cards[cardId]) return b
      Object.assign(b.cards[cardId], patch)
      return b
    })
  }

  const deleteCard = cardId => {
    setOpenCardId(null)
    const queued = mutate(b => {
      delete b.cards[cardId]
      b.columns.forEach(c => { c.cardIds = c.cardIds.filter(x => x !== cardId) })
      return b
    })
    if (queued) window.mobius?.signal?.('item_deleted')
  }

  const moveCard = (cardId, toColId, toIndex) => {
    mutate(b => {
      const from = b.columns.find(c => c.cardIds.includes(cardId))
      const to = b.columns.find(c => c.id === toColId)
      if (!to || !b.cards[cardId]) return b
      if (from) from.cardIds = from.cardIds.filter(x => x !== cardId)
      const i = toIndex == null ? to.cardIds.length : Math.max(0, Math.min(toIndex, to.cardIds.length))
      to.cardIds.splice(i, 0, cardId)
      return b
    })
  }

  const addColumn = () => {
    const id = uid()
    mutate(b => { b.columns.push({ id, name: 'New list', cardIds: [] }); return b })
  }

  const renameColumn = (colId, name) => {
    mutate(b => {
      const col = b.columns.find(c => c.id === colId)
      if (col) col.name = name || col.name
      return b
    })
  }

  const deleteColumn = colId => {
    setConfirmDeleteCol(null)
    mutate(b => {
      const col = b.columns.find(c => c.id === colId)
      if (!col) return b
      col.cardIds.forEach(id => delete b.cards[id])
      b.columns = b.columns.filter(c => c.id !== colId)
      return b
    })
  }

  const renameBoard = title => mutate(b => { b.title = title || b.title; return b })

  // ---- drag & drop (pointer events; long-press on touch) ----
  const startDrag = (e, cardId) => {
    if (e.button != null && e.button !== 0) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const isTouch = e.pointerType === 'touch'
    const start = { x: e.clientX, y: e.clientY }
    let active = false
    let holdTimer = null

    const begin = () => {
      active = true
      rectsRef.current = Array.from(document.querySelectorAll('[data-col-id]')).map(c => ({
        id: c.dataset.colId,
        rect: c.getBoundingClientRect(),
        cardEls: Array.from(c.querySelectorAll('[data-card-id]')).map(cc => ({
          id: cc.dataset.cardId,
          rect: cc.getBoundingClientRect(),
        })),
      }))
      const b = boardRef.current
      const fromCol = b.columns.find(c => c.cardIds.includes(cardId))?.id
      const d = {
        cardId, fromCol,
        w: rect.width, h: rect.height,
        dx: start.x - rect.left, dy: start.y - rect.top,
        x: e.clientX, y: e.clientY,
        overCol: fromCol,
        overIndex: null,
        moved: false,
      }
      dragRef.current = d
      setDrag({ ...d })
      navigator.vibrate?.(10)
    }

    const locate = (x, y) => {
      const cols = rectsRef.current || []
      let over = null
      for (const c of cols) {
        const r = c.rect
        if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 20 && y <= r.bottom + 20) { over = c; break }
      }
      if (!over) return { overCol: null, overIndex: null }
      let idx = 0
      for (const cc of over.cardEls) {
        if (cc.id === cardId) continue
        if (y > cc.rect.top + cc.rect.height / 2) idx++
      }
      return { overCol: over.id, overIndex: idx }
    }

    const onMove = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (!active) {
        if (isTouch) {
          if (Math.hypot(dx, dy) > 10) cleanup() // user is scrolling
        } else if (Math.hypot(dx, dy) > 5) begin()
        if (!active) return
      }
      ev.preventDefault()
      const { overCol, overIndex } = locate(ev.clientX, ev.clientY)
      const d = dragRef.current
      if (!d) return
      Object.assign(d, { x: ev.clientX, y: ev.clientY, overCol, overIndex, moved: true })
      setDrag({ ...d })
    }

    const onUp = () => {
      const d = dragRef.current
      cleanup()
      if (d && active && d.moved && d.overCol) {
        moveCard(cardId, d.overCol, d.overIndex)
      }
    }

    const cleanup = () => {
      clearTimeout(holdTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
      dragRef.current = null
      setDrag(null)
    }

    if (isTouch) holdTimer = setTimeout(begin, 320)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
  }

  const suppressClick = useRef(false)
  useEffect(() => {
    if (drag?.moved) suppressClick.current = true
    else if (!drag) setTimeout(() => { suppressClick.current = false }, 80)
  }, [drag])
  const openCard = id => { if (!suppressClick.current) setOpenCardId(id) }

  if (!board) return <div className="kb-board" />

  const openCard_ = openCardId ? board.cards[openCardId] : null
  const totalCards = Object.keys(board.cards).length
  const access = boardAccess(share, online)

  return (
    <>
      <div className="kb-header">
        <button className="kb-iconbtn kb-backbtn" aria-label="Back to boards" onClick={onBack}>
          <ChevronLeft />
        </button>
        <div className="kb-title-wrap">
          <input
            className="kb-title"
            defaultValue={board.title}
            key={`t-${board.title}`}
            aria-label="Board name"
            readOnly={!access.canWrite}
            onBlur={e => { if (e.target.value.trim() && e.target.value !== board.title) renameBoard(e.target.value.trim()) }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          <div className="kb-sub">{totalCards === 1 ? '1 card' : `${totalCards} cards`}</div>
        </div>
        {access.status && <span className="kb-offline">{access.status}</span>}
        {online && syncNote && <span className="kb-offline">{syncNote}</span>}
        <button className="kb-iconbtn" aria-label="Share board" onClick={() => setShareOpen(true)}>
          <Share />
        </button>
      </div>
      <div className="kb-divider" />
      <div className="kb-board">
        {board.columns.map(col => {
          const showGap = drag && drag.moved && drag.overCol === col.id
          const cards = col.cardIds.map(id => board.cards[id]).filter(Boolean)
          return (
            <section key={col.id} data-col-id={col.id} className={`kb-col${showGap ? ' kb-drop' : ''}`} aria-label={col.name}>
              <div className="kb-col-head">
                <input
                  className="kb-col-name"
                  defaultValue={col.name}
                  key={`c-${col.id}-${col.name}`}
                  aria-label="List name"
                  readOnly={!access.canWrite}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== col.name) renameColumn(col.id, e.target.value.trim()) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
                <span className="kb-count">{cards.length}</span>
                {access.canWrite && <button
                  className="kb-iconbtn"
                  aria-label={`Delete list ${col.name}`}
                  onClick={() => (cards.length ? setConfirmDeleteCol(col.id) : deleteColumn(col.id))}
                >
                  <Trash />
                </button>}
              </div>
              {access.canWrite && confirmDeleteCol === col.id && (
                <div className="kb-composer" role="alertdialog" aria-label="Confirm delete">
                  <div className="kb-empty">Delete “{col.name}” and its {cards.length} card{cards.length === 1 ? '' : 's'}?</div>
                  <div className="kb-composer-row">
                    <button className="kb-btn kb-btn-primary" style={{ background: '#ef4444' }} onClick={() => deleteColumn(col.id)}>Delete</button>
                    <button className="kb-btn kb-btn-quiet" onClick={() => setConfirmDeleteCol(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="kb-cards">
                {cards.map((card, i) => {
                  const els = []
                  if (showGap && drag.overIndex === i && drag.cardId !== card.id) {
                    els.push(<div key={`gap-${i}`} className="kb-gap" style={{ height: drag.h }} />)
                  }
                  els.push(
                    <Card
                      key={card.id}
                      card={card}
                      lifted={drag?.cardId === card.id && drag.moved}
                      onOpen={openCard}
                      onDragStart={startDrag}
                      canWrite={access.canWrite}
                    />,
                  )
                  return els
                })}
                {showGap && drag.overIndex >= cards.filter(c => c.id !== drag.cardId).length && (
                  <div className="kb-gap" style={{ height: drag.h }} />
                )}
                {cards.length === 0 && !showGap && composerCol !== col.id && (
                  <div className="kb-empty">Nothing here yet</div>
                )}
              </div>
              {access.canWrite && (composerCol === col.id ? (
                <Composer onAdd={t => addCard(col.id, t)} onClose={() => setComposerCol(null)} />
              ) : (
                <button className="kb-addcard" onClick={() => setComposerCol(col.id)}>
                  <Plus /> Add card
                </button>
              ))}
            </section>
          )
        })}
        {access.canWrite && <button className="kb-addcol" onClick={addColumn}><Plus /> Add list</button>}
      </div>

      {drag?.moved && (
        <div
          className="kb-card kb-ghost"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}
        >
          {board.cards[drag.cardId]?.label !== 'none' && (
            <div className="kb-label" style={{ background: LABELS[board.cards[drag.cardId]?.label] }} />
          )}
          <div className="kb-card-title">{board.cards[drag.cardId]?.title}</div>
        </div>
      )}

      {openCard_ && (
        <>
          <div className="kb-scrim" onClick={() => setOpenCardId(null)} />
          <div className="kb-sheet" role="dialog" aria-label="Card details">
            <div className="kb-sheet-grab" />
            <textarea
              className="kb-input"
              rows={2}
              defaultValue={openCard_.title}
              key={`st-${openCard_.id}`}
              aria-label="Card title"
              readOnly={!access.canWrite}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== openCard_.title) updateCard(openCard_.id, { title: v }) }}
            />
            <textarea
              className="kb-input"
              rows={3}
              placeholder="Notes…"
              defaultValue={openCard_.notes}
              key={`sn-${openCard_.id}`}
              aria-label="Card notes"
              readOnly={!access.canWrite}
              onBlur={e => { if (e.target.value !== openCard_.notes) updateCard(openCard_.id, { notes: e.target.value }) }}
            />
            {access.canWrite && <div>
              <h3>Label</h3>
              <div className="kb-swatches" style={{ marginTop: 8 }}>
                {Object.entries(LABELS).map(([name, color]) => (
                  <button
                    key={name}
                    className={`kb-swatch${name === 'none' ? ' kb-none' : ''}${(openCard_.label || 'none') === name ? ' kb-on' : ''}`}
                    style={name === 'none' ? undefined : { background: color }}
                    aria-label={`Label ${name}`}
                    onClick={() => updateCard(openCard_.id, { label: name })}
                  />
                ))}
              </div>
            </div>}
            {access.canWrite && <div>
              <h3>Move to</h3>
              <div className="kb-chips" style={{ marginTop: 8 }}>
                {board.columns.map(c => {
                  const here = c.cardIds.includes(openCard_.id)
                  return (
                    <button
                      key={c.id}
                      className={`kb-chip${here ? ' kb-on' : ''}`}
                      disabled={here}
                      onClick={() => { moveCard(openCard_.id, c.id, null); setOpenCardId(null) }}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>}
            <div className="kb-sheet-row" style={{ justifyContent: 'space-between' }}>
              {access.canWrite && <button className="kb-btn kb-btn-quiet kb-danger" onClick={() => deleteCard(openCard_.id)}>
                Delete card
              </button>}
              <button className="kb-btn kb-btn-primary" onClick={() => setOpenCardId(null)}>Done</button>
            </div>
          </div>
        </>
      )}

      {shareOpen && (
        <ShareSheet
          board={board}
          boardId={boardId}
          share={share}
          onShared={onShared}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  )
}
