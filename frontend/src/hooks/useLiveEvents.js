import { useEffect, useRef, useState } from 'react'

export function useLiveEvents(onEvent) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])
  const cb = useRef(onEvent)
  cb.current = onEvent

  useEffect(() => {
    let ws, timer, alive = true
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws/events`)
      ws.onopen = () => { setConnected(true); timer = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000) }
      ws.onmessage = (m) => {
        try {
          const ev = { ...JSON.parse(m.data), at: new Date() }
          setEvents((e) => [ev, ...e].slice(0, 30))
          cb.current?.(ev)
        } catch { /* ignore */ }
      }
      ws.onclose = () => { setConnected(false); clearInterval(timer); if (alive) setTimeout(connect, 2000) }
    }
    connect()
    return () => { alive = false; clearInterval(timer); ws?.close() }
  }, [])

  return { connected, events }
}
