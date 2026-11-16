import { useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => (localStorage.getItem('cp_theme') ?? 'dark') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('cp_theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
