import { useState } from 'react'
import { Plus, Trash } from '@openai/apps-sdk-ui/components/Icon'
import { invitationKey } from '../domain.js'

export default function Home({ boards, shareMap = {}, invitations = [], online, onOpen, onCreate, onDelete, onAccept, onDecline }) {
  const [confirmId, setConfirmId] = useState(null)
  const [invError, setInvError] = useState(null)
  const [busyInv, setBusyInv] = useState(null)

  return (
    <>
      <div className="kb-header">
        <div className="kb-title-wrap">
          <div className="kb-title-static">Boards</div>
          <div className="kb-sub">{boards.length === 1 ? '1 board' : `${boards.length} boards`}</div>
        </div>
        {!online && <span className="kb-offline">Offline — local boards still work</span>}
      </div>
      <div className="kb-divider" />
      <div className="kb-home">
        {boards.map(b => (
          <div key={b.id} style={{ position: 'relative' }}>
            <button className="kb-tile" onClick={() => onOpen(b.id)}>
              <div className="kb-tile-title">{b.title}</div>
              <div className="kb-tile-bars" aria-hidden="true">
                {Array.from({ length: Math.max(3, Math.min(b.columnCount, 5)) }).map((_, i) => (
                  <span key={i} className={`kb-tile-bar${i < b.columnCount ? ' kb-fill' : ''}`} />
                ))}
              </div>
              <div className="kb-tile-meta">
                {b.cardCount === 1 ? '1 card' : `${b.cardCount} cards`} · {b.columnCount === 1 ? '1 list' : `${b.columnCount} lists`}
                {shareMap[b.id] ? ' · shared' : ''}
              </div>
            </button>
            {confirmId === b.id ? (
              <div className="kb-composer" style={{ position: 'absolute', inset: 'auto 0 8px', margin: '0 10px', background: 'var(--surface)', borderRadius: 12, padding: 8 }} role="alertdialog" aria-label="Confirm delete board">
                <div className="kb-empty">Delete “{b.title}”?</div>
                <div className="kb-composer-row">
                  <button className="kb-btn kb-btn-primary" style={{ background: '#ef4444' }} onClick={() => { setConfirmId(null); onDelete(b.id) }}>Delete</button>
                  <button className="kb-btn kb-btn-quiet" onClick={() => setConfirmId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="kb-iconbtn kb-tile-del" aria-label={`Delete board ${b.title}`} onClick={() => setConfirmId(b.id)}>
                <Trash />
              </button>
            )}
          </div>
        ))}
        <button className="kb-tile kb-newtile" onClick={onCreate}>
          <Plus /> New board
        </button>
        {invitations.map(inv => {
          const key = invitationKey(inv)
          return (
            <div key={key} className="kb-tile" style={{ cursor: 'default', borderColor: 'var(--accent)' }}>
              <div className="kb-tile-title" style={{ fontSize: 15 }}>{inv.label || 'A shared board'}</div>
              <div className="kb-tile-meta" style={{ marginTop: 0 }}>
                {inv.from_name || inv.host} invited you · {inv.role === 'viewer' ? 'view only' : 'can edit'}
              </div>
              {invError?.key === key && <div className="kb-empty" style={{ color: '#ef4444', padding: 0, textAlign: 'left' }}>{invError.message}</div>}
              <div className="kb-composer-row">
                <button
                  className="kb-btn kb-btn-primary"
                  disabled={busyInv !== null}
                  onClick={async () => {
                    setBusyInv(key); setInvError(null)
                    try { await onAccept(inv) } catch (e) { setInvError({ key, message: String(e?.message || e) }) }
                    finally { setBusyInv(null) }
                  }}
                >Accept</button>
                <button
                  className="kb-btn kb-btn-quiet"
                  disabled={busyInv !== null}
                  onClick={async () => {
                    setBusyInv(key); setInvError(null)
                    try { await onDecline(inv) } catch (e) { setInvError({ key, message: String(e?.message || e) }) }
                    finally { setBusyInv(null) }
                  }}
                >Decline</button>
              </div>
            </div>
          )
        })}
        {boards.length === 0 && (
          <div className="kb-home-empty">Create your first board to start organizing.</div>
        )}
      </div>
    </>
  )
}
