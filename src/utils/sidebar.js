const MOBILE_QUERY = '(max-width: 768px)'

const isMobile = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(MOBILE_QUERY).matches

const getSidebar = () =>
  typeof document !== 'undefined'
    ? document.getElementById('sidebar')
    : null

const getToggle = sidebar =>
  sidebar?.querySelector?.('input[type="checkbox"][data-sidebar-toggle]')

const setSidebarOpen = open => {
  const sidebar = getSidebar()
  const toggle = sidebar && getToggle(sidebar)
  if (!sidebar || !toggle) return

  toggle.checked = !!open
  if (open) sidebar.dataset.sidebarOpen = 'true'
  else delete sidebar.dataset.sidebarOpen
}

const doc = typeof document !== 'undefined' ? document : null

doc && doc.addEventListener('change', event => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (!target.matches('input[type="checkbox"][data-sidebar-toggle]')) return

  const sidebar = target.closest?.('#sidebar') || getSidebar()
  if (!sidebar) return

  if (target.checked) sidebar.dataset.sidebarOpen = 'true'
  else delete sidebar.dataset.sidebarOpen
})

doc && doc.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  if (!isMobile()) return

  const sidebar = getSidebar()
  const toggle = sidebar && getToggle(sidebar)
  if (!toggle?.checked) return

  setSidebarOpen(false)
})

doc && doc.addEventListener('pointerdown', event => {
  if (!isMobile()) return

  const sidebar = getSidebar()
  const toggle = sidebar && getToggle(sidebar)
  if (!toggle?.checked) return

  sidebar.contains(event.target) || setSidebarOpen(false)
})
