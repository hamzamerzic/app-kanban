import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, ChevronDown, ChevronLeft, Filter, Grid, Plus, Share, Trash } from '@openai/apps-sdk-ui/components/Icon'
import { uid, subscribeBoard, getBoard, casMutate, boardPath, normalizeBoard } from '../storage.js'
import { pullShared, pushSharedOp, inviteByHandle, getMembers, revokeMember, shareBoard } from '../sync.js'
import {
  addChecklistItem,
  assigneeAvatar,
  boardAccess,
  cardMatchesFilters,
  checklistProgress,
  defaultColumnColor,
  deleteChecklistItem,
  dueDateStatus,
  formatDueDate,
  swapColumns,
  toggleChecklistItem,
  visibleToFullIndex,
} from '../domain.js'

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
  const dueStatus = dueDateStatus(card.due)
  const progress = checklistProgress(card.checklist)
  const assignee = card.assignee?.trim()
  const avatar = assignee ? assigneeAvatar(assignee) : null
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
      {(dueStatus || progress.total > 0 || avatar) && <div className="kb-card-meta">
        {dueStatus && <span className={`kb-due kb-due-${dueStatus}`}>{formatDueDate(card.due)}</span>}
        {progress.total > 0 && <div className="kb-check-progress">
          <span>{progress.done}/{progress.total}</span>
          <span
            className="kb-progress-track"
            role="progressbar"
            aria-label={`${progress.done} of ${progress.total} checklist items complete`}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <span className="kb-progress-fill" style={{ width: `${progress.percent}%` }} />
          </span>
        </div>}
        <span className="kb-card-meta-spacer" />
        {avatar && <span
          className="kb-avatar"
          style={{ background: avatar.background, color: avatar.color }}
          title={assignee}
          role="img"
          aria-label={`Assigned to ${assignee}`}
        >{avatar.initials}</span>}
      </div>}
    </div>
  )
}

function memberDisplayNames(metadata) {
  const members = metadata?.members
    ?? metadata?.metadata?.members
    ?? metadata?.member_names
    ?? metadata?.metadata?.member_names
  const values = Array.isArray(members)
    ? members
    : members && typeof members === 'object' ? Object.values(members) : []
  return [...new Set(values.map(member => {
    if (typeof member === 'string') return member.trim()
    return String(member?.displayName || member?.display_name || member?.name || '').trim()
  }).filter(Boolean))]
}

function BoardSwitcher({ board, boardId, boards, shareMap, canWrite, open, onOpenChange, onRename, onSelect, onCreate }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = event => { if (event.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const cardCount = Object.keys(board.cards).length
  const commitTitle = target => {
    const title = target.value.trim()
    if (title && title !== board.title) onRename(title)
    else target.value = board.title
  }

  return (
    <div className="kb-switcher-wrap">
      <button
        className="kb-switcher-button"
        aria-label={`Switch board, current board ${board.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span>{board.title}</span>
        <ChevronDown />
      </button>
      {open && <>
        <div className="kb-scrim kb-switcher-scrim" onClick={() => onOpenChange(false)} />
        <div className="kb-sheet kb-switcher-panel" role="dialog" aria-label="Switch boards">
          <div className="kb-sheet-grab" />
          <input
            className="kb-input kb-switcher-title"
            defaultValue={board.title}
            key={`switch-title-${board.title}`}
            aria-label="Current board name"
            readOnly={!canWrite}
            onBlur={event => commitTitle(event.currentTarget)}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
          />
          <div className="kb-switcher-rows">
            {boards.map(item => {
              const current = item.id === boardId
              const title = current ? board.title : item.title
              const count = current ? cardCount : item.cardCount
              return <button
                key={item.id}
                className={`kb-switcher-row${current ? ' kb-current' : ''}`}
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  if (!current) onSelect(item.id)
                  onOpenChange(false)
                }}
              >
                <span className="kb-switcher-row-main">
                  <span className="kb-switcher-row-title">{title}</span>
                  <span className="kb-switcher-row-meta">
                    {count === 1 ? '1 card' : `${count} cards`}
                    {shareMap[item.id] && <span className="kb-shared-tag">shared</span>}
                  </span>
                </span>
                {current && <Check />}
              </button>
            })}
            <button className="kb-switcher-row kb-switcher-new" onClick={() => { onOpenChange(false); onCreate() }}>
              <Plus />
              <span className="kb-switcher-row-title">New board</span>
            </button>
          </div>
        </div>
      </>}
    </div>
  )
}

function AssigneeEditor({ card, canWrite, suggestions, onUpdate }) {
  const [value, setValue] = useState(card.assignee || '')
  useEffect(() => { setValue(card.assignee || '') }, [card.id, card.assignee])
  const commit = nextValue => {
    const next = String(nextValue).trim()
    setValue(next)
    if (next !== (card.assignee || '')) onUpdate(next)
  }
  return (
    <div className="kb-assignee-editor">
      <input
        className="kb-input"
        value={value}
        placeholder="Display name…"
        aria-label="Card assignee"
        readOnly={!canWrite}
        onChange={event => setValue(event.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
      {canWrite && suggestions.length > 0 && <div className="kb-chips kb-assignee-suggestions" aria-label="Board members">
        {suggestions.map(name => <button
          key={name}
          className="kb-chip"
          type="button"
          onClick={() => commit(name)}
        >{name}</button>)}
      </div>}
    </div>
  )
}

function ChecklistEditor({ checklist, canWrite, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState('')
  const submit = () => {
    const value = text.trim()
    if (!value || !canWrite) return
    onAdd(value)
    setText('')
  }
  return (
    <div className="kb-checklist">
      {checklist.map(item => (
        <div className="kb-check-item" key={item.id}>
          <label className="kb-check-toggle">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!canWrite}
              onChange={() => onToggle(item.id)}
            />
            <span className={item.done ? 'kb-check-done' : ''}>{item.text}</span>
          </label>
          {canWrite && <button
            className="kb-iconbtn"
            aria-label={`Delete checklist item ${item.text}`}
            onClick={() => onDelete(item.id)}
          >
            <Trash />
          </button>}
        </div>
      ))}
      {canWrite && <div className="kb-check-add">
        <input
          className="kb-input"
          value={text}
          placeholder="Add checklist item…"
          aria-label="New checklist item"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
        />
        <button className="kb-btn kb-btn-primary" disabled={!text.trim()} onClick={submit}>Add</button>
      </div>}
      {!checklist.length && !canWrite && <div className="kb-empty">No checklist items</div>}
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

export default function Board({
  boardId,
  boards,
  shareMap,
  onAllBoards,
  onSwitchBoard,
  onCreateBoard,
  onBoardRenamed,
  online,
  share,
  onShared,
}) {
  const [board, setBoard] = useState(null)
  const [composerCol, setComposerCol] = useState(null)
  const [openCardId, setOpenCardId] = useState(null)
  const [confirmDeleteCol, setConfirmDeleteCol] = useState(null)
  const [drag, setDrag] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterLabels, setFilterLabels] = useState([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [memberNames, setMemberNames] = useState([])
  const [animateColumns, setAnimateColumns] = useState(true)

  const boardRef = useRef(null)
  const boardScrollRef = useRef(null)
  const pendingRef = useRef(0)
  const writeChain = useRef(Promise.resolve())
  const dragRef = useRef(null)
  const rectsRef = useRef(null)
  const versionRef = useRef(-1)
  const shareRef = useRef(share)
  const onlineRef = useRef(online)
  const filtersRef = useRef({ text: filterText, labels: filterLabels })
  boardRef.current = board
  shareRef.current = share
  onlineRef.current = online
  filtersRef.current = { text: filterText, labels: filterLabels }

  useEffect(() => {
    if (!board || !animateColumns) return undefined
    if (board.columns.length === 0) {
      setAnimateColumns(false)
      return undefined
    }
    const timer = setTimeout(() => setAnimateColumns(false), 185 + board.columns.length * 25)
    return () => clearTimeout(timer)
  }, [!!board, animateColumns])

  useEffect(() => {
    let alive = true
    setMemberNames([])
    if (share?.hosted) {
      getMembers(share.oid).then(result => {
        if (alive) setMemberNames(memberDisplayNames(result))
      }).catch(() => {})
    }
    return () => { alive = false }
  }, [share?.hosted, share?.oid])

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
          const normalized = normalizeBoard(state.doc)
          window.mobius?.storage?.set(boardPath(boardId), normalized).catch(() => {})
          if (pendingRef.current === 0 && !dragRef.current) setBoard(normalized)
        }
        if (!share.hosted && state.object) {
          const names = memberDisplayNames(state.object)
          if (names.length) setMemberNames(names)
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
    const createdAt = new Date().toISOString()
    const queued = mutate(b => {
      const col = b.columns.find(c => c.id === colId)
      if (!col) return b
      b.cards[id] = { id, title, notes: '', label: 'none', due: '', checklist: [], assignee: '', createdAt }
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

  const addCheckItem = (cardId, text) => {
    const item = { id: uid(), text, done: false }
    mutate(b => {
      const card = b.cards[cardId]
      if (card) card.checklist = addChecklistItem(card.checklist, item)
      return b
    })
  }

  const toggleCheckItem = (cardId, itemId) => {
    mutate(b => {
      const card = b.cards[cardId]
      if (card) card.checklist = toggleChecklistItem(card.checklist, itemId)
      return b
    })
  }

  const removeCheckItem = (cardId, itemId) => {
    mutate(b => {
      const card = b.cards[cardId]
      if (card) card.checklist = deleteChecklistItem(card.checklist, itemId)
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
    mutate(b => {
      b.columns.push({ id, name: 'New list', color: defaultColumnColor(b.columns.length), cardIds: [] })
      return b
    })
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

  const reorderColumn = (colId, offset) => {
    mutate(b => {
      b.columns = swapColumns(b.columns, colId, offset)
      return b
    })
  }

  const renameBoard = title => {
    const next = title.trim()
    if (!next || next === boardRef.current?.title) return
    if (mutate(b => { b.title = next; return b })) onBoardRenamed(boardId, next)
  }

  // ---- drag & drop (pointer events; long-press on touch) ----
  const startDrag = (e, cardId) => {
    if (e.button != null && e.button !== 0) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const isTouch = e.pointerType === 'touch'
    const start = { x: e.clientX, y: e.clientY }
    let active = false
    let holdTimer = null
    let scrollFrame = null
    let pointer = { ...start }

    const measure = () => {
      const root = boardScrollRef.current
      rectsRef.current = Array.from(root?.querySelectorAll('[data-col-id]') || []).map(c => ({
        id: c.dataset.colId,
        rect: c.getBoundingClientRect(),
        cardEls: Array.from(c.querySelectorAll('[data-card-id]')).map(cc => ({
          id: cc.dataset.cardId,
          rect: cc.getBoundingClientRect(),
        })),
      }))
    }

    const begin = () => {
      active = true
      measure()
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
      scrollFrame = requestAnimationFrame(autoScroll)
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

    const updatePosition = (x, y) => {
      const { overCol, overIndex } = locate(x, y)
      const d = dragRef.current
      if (!d) return
      Object.assign(d, { x, y, overCol, overIndex, moved: true })
      setDrag({ ...d })
    }

    function autoScroll() {
      const scroller = boardScrollRef.current
      const d = dragRef.current
      if (!active || !scroller || !d) return
      if (d.moved) {
        const bounds = scroller.getBoundingClientRect()
        const edge = 48
        let delta = 0
        if (pointer.x < bounds.left + edge) {
          delta = -Math.ceil((bounds.left + edge - pointer.x) / 4)
        } else if (pointer.x > bounds.right - edge) {
          delta = Math.ceil((pointer.x - (bounds.right - edge)) / 4)
        }
        if (delta) {
          const before = scroller.scrollLeft
          scroller.scrollLeft += delta
          if (scroller.scrollLeft !== before) {
            measure()
            updatePosition(pointer.x, pointer.y)
          }
        }
      }
      scrollFrame = requestAnimationFrame(autoScroll)
    }

    const onMove = ev => {
      pointer = { x: ev.clientX, y: ev.clientY }
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (!active) {
        if (isTouch) {
          if (Math.hypot(dx, dy) > 10) cleanup() // user is scrolling
        } else if (Math.hypot(dx, dy) > 5) begin()
        if (!active) return
      }
      ev.preventDefault()
      updatePosition(ev.clientX, ev.clientY)
    }

    const onUp = () => {
      const d = dragRef.current
      let fullIndex = null
      if (d && active && d.moved && d.overCol) {
        const current = boardRef.current
        const column = current?.columns.find(c => c.id === d.overCol)
        const filters = filtersRef.current
        const visibleIds = column?.cardIds.filter(id =>
          cardMatchesFilters(current.cards[id], filters.text, filters.labels),
        ) || []
        fullIndex = visibleToFullIndex(column?.cardIds, visibleIds, d.overIndex, cardId)
      }
      cleanup()
      if (d && active && d.moved && d.overCol) {
        moveCard(cardId, d.overCol, fullIndex)
      }
    }

    const cleanup = () => {
      clearTimeout(holdTimer)
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
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
  const access = boardAccess(share, online)
  const hasFilters = !!filterText.trim() || filterLabels.length > 0

  return (
    <>
      <div className="kb-header kb-board-header">
        <button className="kb-iconbtn kb-homebtn" aria-label="All boards" onClick={onAllBoards}>
          <Grid />
        </button>
        <BoardSwitcher
          board={board}
          boardId={boardId}
          boards={boards}
          shareMap={shareMap}
          canWrite={access.canWrite}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
          onRename={renameBoard}
          onSelect={onSwitchBoard}
          onCreate={onCreateBoard}
        />
        <div className="kb-header-spacer" />
        {access.status && <span className="kb-offline">{access.status}</span>}
        {online && syncNote && <span className="kb-offline">{syncNote}</span>}
        <button
          className={`kb-iconbtn${hasFilters ? ' kb-filter-active' : ''}`}
          aria-label="Filter cards"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(open => !open)}
        >
          <Filter />
        </button>
        <button className="kb-iconbtn" aria-label="Share board" onClick={() => setShareOpen(true)}>
          <Share />
        </button>
      </div>
      <div className="kb-divider" />
      {filtersOpen && <div className="kb-filterbar" aria-label="Card filters">
        <input
          className="kb-input kb-filter-input"
          type="search"
          placeholder="Filter title or notes…"
          aria-label="Filter cards by title or notes"
          value={filterText}
          onChange={event => setFilterText(event.target.value)}
        />
        <div className="kb-filter-labels" aria-label="Filter by label">
          {Object.entries(LABELS).map(([name, color]) => {
            const active = filterLabels.includes(name)
            return <button
              key={name}
              className={`kb-filter-dot-btn${active ? ' kb-on' : ''}`}
              aria-label={name === 'none' ? 'Filter unlabeled cards' : `Filter ${name} cards`}
              aria-pressed={active}
              onClick={() => setFilterLabels(labels =>
                labels.includes(name) ? labels.filter(label => label !== name) : [...labels, name],
              )}
            >
              <span
                className={`kb-filter-dot${name === 'none' ? ' kb-none' : ''}`}
                style={name === 'none' ? undefined : { background: color }}
              />
            </button>
          })}
        </div>
      </div>}
      <div className={`kb-board${animateColumns ? ' kb-board-enter' : ''}${board.columns.length === 0 ? ' kb-board-empty' : ''}`} ref={boardScrollRef}>
        {board.columns.length === 0 && <div className="kb-empty-board-state">
          <div className="kb-empty-board-title">No lists yet</div>
          <div className="kb-empty">Add a list to start organizing this board.</div>
          <button className="kb-btn kb-btn-primary" disabled={!access.canWrite} onClick={addColumn}>
            <Plus /> Add list
          </button>
        </div>}
        {board.columns.map((col, columnIndex) => {
          const showGap = drag && drag.moved && drag.overCol === col.id
          const allCards = col.cardIds.map(id => board.cards[id]).filter(Boolean)
          const cards = allCards.filter(card => cardMatchesFilters(card, filterText, filterLabels))
          const cardNodes = []
          let dropPosition = 0
          for (const card of cards) {
            if (showGap && card.id !== drag.cardId && drag.overIndex === dropPosition) {
              cardNodes.push(<div key={`gap-${dropPosition}`} className="kb-gap" style={{ height: drag.h }} />)
            }
            cardNodes.push(<Card
              key={card.id}
              card={card}
              lifted={drag?.cardId === card.id && drag.moved}
              onOpen={openCard}
              onDragStart={startDrag}
              canWrite={access.canWrite}
            />)
            if (card.id !== drag?.cardId) dropPosition += 1
          }
          if (showGap && drag.overIndex >= dropPosition) {
            cardNodes.push(<div key={`gap-${dropPosition}`} className="kb-gap" style={{ height: drag.h }} />)
          }
          return (
            <section
              key={col.id}
              data-col-id={col.id}
              className={`kb-col${showGap ? ' kb-drop' : ''}`}
              style={{ '--kb-col-index': columnIndex }}
              aria-label={col.name}
            >
              <div className="kb-col-head">
                <span
                  className="kb-col-status"
                  style={{ background: col.color ? (LABELS[col.color] || 'var(--muted)') : 'var(--muted)' }}
                  aria-hidden="true"
                />
                <input
                  className="kb-col-name"
                  defaultValue={col.name}
                  key={`c-${col.id}-${col.name}`}
                  aria-label="List name"
                  readOnly={!access.canWrite}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== col.name) renameColumn(col.id, e.target.value.trim()) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
                <span className="kb-count">{hasFilters ? `${cards.length}/${allCards.length}` : allCards.length}</span>
                <div className="kb-col-actions">
                  <div className="kb-col-reorder" aria-label={`Reorder list ${col.name}`}>
                  <button
                    className="kb-iconbtn kb-col-action"
                    aria-label={`Move list ${col.name} left`}
                    disabled={!access.canWrite || columnIndex === 0}
                    onClick={() => reorderColumn(col.id, -1)}
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    className="kb-iconbtn kb-col-action kb-chevron-right"
                    aria-label={`Move list ${col.name} right`}
                    disabled={!access.canWrite || columnIndex === board.columns.length - 1}
                    onClick={() => reorderColumn(col.id, 1)}
                  >
                    <ChevronLeft />
                  </button>
                  </div>
                  <button
                  className="kb-iconbtn kb-col-action"
                  aria-label={`Delete list ${col.name}`}
                  disabled={!access.canWrite}
                  onClick={() => (allCards.length ? setConfirmDeleteCol(col.id) : deleteColumn(col.id))}
                >
                  <Trash />
                  </button>
                </div>
              </div>
              {access.canWrite && confirmDeleteCol === col.id && (
                <div className="kb-composer" role="alertdialog" aria-label="Confirm delete">
                  <div className="kb-empty">Delete “{col.name}” and its {allCards.length} card{allCards.length === 1 ? '' : 's'}?</div>
                  <div className="kb-composer-row">
                    <button className="kb-btn kb-btn-primary" style={{ background: '#ef4444' }} onClick={() => deleteColumn(col.id)}>Delete</button>
                    <button className="kb-btn kb-btn-quiet" onClick={() => setConfirmDeleteCol(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="kb-cards">
                {cardNodes}
                {cards.length === 0 && !showGap && composerCol !== col.id && (
                  <div className="kb-empty">{hasFilters && allCards.length ? 'No matching cards' : 'Nothing here yet'}</div>
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
        {access.canWrite && board.columns.length > 0 && <button className="kb-addcol" onClick={addColumn}><Plus /> Add list</button>}
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
            <div>
              <h3>Due date</h3>
              <input
                className="kb-input kb-date-input"
                style={{ marginTop: 8 }}
                type="date"
                value={openCard_.due || ''}
                aria-label="Card due date"
                readOnly={!access.canWrite}
                onChange={event => updateCard(openCard_.id, { due: event.target.value })}
              />
            </div>
            <div>
              <h3>Checklist</h3>
              <ChecklistEditor
                checklist={Array.isArray(openCard_.checklist) ? openCard_.checklist : []}
                canWrite={access.canWrite}
                onAdd={text => addCheckItem(openCard_.id, text)}
                onToggle={itemId => toggleCheckItem(openCard_.id, itemId)}
                onDelete={itemId => removeCheckItem(openCard_.id, itemId)}
              />
            </div>
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
            <div>
              <h3>Assignee</h3>
              <AssigneeEditor
                card={openCard_}
                canWrite={access.canWrite}
                suggestions={share ? memberNames : []}
                onUpdate={assignee => updateCard(openCard_.id, { assignee })}
              />
            </div>
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
