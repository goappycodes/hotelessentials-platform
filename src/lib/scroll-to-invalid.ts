import type { BaseSyntheticEvent } from "react"

// A moment for the form to show its errors (some fields only appear with one).
const RENDER_DELAY_MS = 50

// After a failed save: brings the form's first invalid field to the middle of the screen,
// clear of the sticky header, and focuses it. Works from the page rather than the form
// library's refs, so dropdowns count too and the order is the order on screen.
//
// Pass it as handleSubmit's second argument, with `shouldFocusError: false` on useForm
// (or the library's own focus jumps there first):
//   form.handleSubmit(onSubmit, scrollToFirstInvalid)
export function scrollToFirstInvalid(_errors: unknown, event?: BaseSyntheticEvent) {
  // The form itself, or a save button in it ("Save and Mark as Sent").
  const target = event?.target
  const form = target instanceof Element ? target.closest("form") : null
  if (!form) return

  setTimeout(() => {
    const field = form.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!field) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    field.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" })
    field.focus({ preventScroll: true })
  }, RENDER_DELAY_MS)
}
