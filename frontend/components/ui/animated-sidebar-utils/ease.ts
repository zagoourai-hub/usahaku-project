// Motion curves shared by the animated sidebar. Not part of the pasted
// component source (beui.dev), so these are our own values in the same roles.

/** Fast start, soft landing: labels, submenus, fades. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** iOS-like drawer curve for sliding panels. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Critically damped: layout moves (active pill, list items) without overshoot. */
export const SPRING_LAYOUT = { type: "spring", stiffness: 500, damping: 40, mass: 0.8 } as const;

/** Short, firm press feedback for whileTap. */
export const SPRING_PRESS = { type: "spring", stiffness: 600, damping: 32 } as const;
