import { useEffect, useRef, useState, useCallback } from 'react'
import { CSS } from './theme.js'
import { listBoards, createBoard, deleteBoard, migrateLegacy, seedFirstBoard } from './storage.js'
import { configureSync, loadShareMap, listInvitations, acceptInvitation, declineInvitation, leaveBoard, deleteSharedObject, removeShareEntry } from './sync.js'
import Home from './ui/Home.jsx'
import Board from './ui/Board.jsx'

export default function App({ appId, token }) {
  const [boards, setBoards] = useState(null)
  const [shareMap, setShareMap] = useState({ byBoard: {} })
  const [invitations, setInvitations] = useState([])
  const [openId, setOpenId] = useState(null)
  const [online, setOnline] = useState(() => window.mobius?.online !== false)
  const navRef = useRef(null)
  const readySignalled = useRef(false)

  configureSync(token)

  const refresh = useCallback(async () => {
    try {
      const [b, map] = await Promise.all([listBoards(), loadShareMap()])
      setBoards(b)
      setShareMap(map)
      // Invitations are additive UI: their fetch failing must not blank boards.
      listInvitations().then(setInvitations).catch(() => {})
      if (!readySignalled.current) {
        readySignalled.current = true
        window.mobius?.signal?.('app_ready', { item_count: b.length })
      }
      return b
    } catch (e) {
      setBoards([])
      window.mobius?.signal?.('error', { message: String(e?.message || e), source: 'list' })
      return null
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await migrateLegacy()
      const b = await refresh()
      // First run: seed one board so the app is immediately useful.
      if (b?.length === 0) {
        try {
          await seedFirstBoard()
          await refresh()
        } catch { /* surface stays on the (empty) home */ }
      }
    })()
    const t = setInterval(() => setOnline(window.mobius?.online !== false), 3000)
    return () => clearInterval(t)
  }, [refresh])

  const closeBoard = useCallback(() => {
    navRef.current?.close()
    navRef.current = null
    setOpenId(null)
    refresh()
  }, [refresh])

  const openBoard = useCallback(async id => {
    const nav = window.mobius?.nav
    if (!nav?.open) { setOpenId(id); return } // degraded/legacy mount: plain state nav
    navRef.current?.close()
    let handle = null
    handle = nav.open('kanban-board', {
      onBack: () => { navRef.current = null; setOpenId(null); refresh() },
      onForward: () => { navRef.current = handle; setOpenId(id) },
    })
    navRef.current = handle
    const { status } = await handle.outcome
    if (navRef.current !== handle) { handle.close(); return }
    if (status !== 'owned') { navRef.current = null; return }
    setOpenId(id)
  }, [refresh])

  const onCreate = useCallback(async () => {
    try {
      const id = await createBoard('New board')
      window.mobius?.signal?.('item_created', { type: 'board' })
      await refresh()
      openBoard(id)
    } catch (e) {
      window.mobius?.signal?.('error', { message: String(e?.message || e), source: 'create-board' })
    }
  }, [refresh, openBoard])

  const onDelete = useCallback(async id => {
    try {
      const entry = (await loadShareMap()).byBoard[id]
      if (entry?.hosted) {
        await deleteSharedObject(entry.oid)
        await removeShareEntry(id)
      } else if (entry) {
        await leaveBoard(id, entry)
      }
      await deleteBoard(id)
      window.mobius?.signal?.('item_deleted')
    } catch (e) {
      window.mobius?.signal?.('error', { message: String(e?.message || e), source: 'delete-board' })
    }
    refresh()
  }, [refresh])

  const onAccept = useCallback(async inv => {
    const { boardId } = await acceptInvitation(inv)
    window.mobius?.signal?.('item_created', { type: 'joined-board' })
    await refresh()
    openBoard(boardId)
  }, [refresh, openBoard])

  const onDecline = useCallback(async inv => {
    await declineInvitation(inv)
    setInvitations(list => list.filter(i => !(i.id === inv.id && i.host === inv.host)))
  }, [])

  return (
    <div className="kb-root">
      <style>{CSS}</style>
      {openId ? (
        <Board
          boardId={openId}
          onBack={closeBoard}
          online={online}
          share={shareMap.byBoard[openId] || null}
          onShared={entry => setShareMap(m => ({ byBoard: { ...m.byBoard, [openId]: entry } }))}
        />
      ) : boards ? (
        <Home
          boards={boards}
          shareMap={shareMap.byBoard}
          invitations={invitations}
          online={online}
          onOpen={openBoard}
          onCreate={onCreate}
          onDelete={onDelete}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ) : null}
    </div>
  )
}
