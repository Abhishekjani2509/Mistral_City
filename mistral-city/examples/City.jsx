import { useEffect, useRef } from 'react'
import { mountCity } from '../city/mistral-city.js'

export default function City({ model, events = [], onSelect }) {
  const host = useRef(null)
  const city = useRef(null)
  const seen = useRef(0)

  // mount once. destroy() in the cleanup is required: React 18 StrictMode
  // mounts, unmounts and remounts in dev, and without it you get two loops.
  useEffect(() => {
    city.current = mountCity(host.current, { onSelect })
    return () => { city.current.destroy(); city.current = null }
  }, [])

  useEffect(() => { if (city.current && model) city.current.setModel(model) }, [model])

  // forward only events we have not sent yet
  useEffect(() => {
    if (!city.current) return
    events.slice(seen.current).forEach(e => city.current.onEvent(e))
    seen.current = events.length
  }, [events])

  return <div ref={host} style={{ position: 'absolute', inset: 0 }} />
}
