import { useEffect } from 'react'

/** Hides the main top navigation while a full-screen editor is mounted. */
export function useHideMainNav() {
  useEffect(() => {
    const mainNav = document.querySelector('nav[aria-label="Main navigation"]')
    const navHeader = mainNav?.closest('header') || mainNav
    if (!navHeader) return undefined

    const prevVisibility = navHeader.style.visibility
    const prevPointerEvents = navHeader.style.pointerEvents
    const prevAriaHidden = navHeader.getAttribute('aria-hidden')

    navHeader.style.visibility = 'hidden'
    navHeader.style.pointerEvents = 'none'
    navHeader.setAttribute('aria-hidden', 'true')

    return () => {
      navHeader.style.visibility = prevVisibility
      navHeader.style.pointerEvents = prevPointerEvents
      if (prevAriaHidden === null) {
        navHeader.removeAttribute('aria-hidden')
      } else {
        navHeader.setAttribute('aria-hidden', prevAriaHidden)
      }
    }
  }, [])
}