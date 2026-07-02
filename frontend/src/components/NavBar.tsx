import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function NavBar() {
  return (
    <nav style={styles.nav}>
      <NavLink to="/" end style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
        Início
      </NavLink>
      <NavLink to="/notas" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
        Notas
      </NavLink>
      <button style={styles.sair} onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </nav>
  )
}

const styles: Record<string, CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: '#16a34a',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  link: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: '500',
    padding: '6px 12px',
    borderRadius: '8px',
  },
  active: {
    color: '#fff',
    background: 'rgba(255,255,255,0.2)',
  },
  sair: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '6px 8px',
  },
}
