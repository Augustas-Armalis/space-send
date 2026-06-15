import type { Transition, Variants } from "framer-motion";

/** The Space Send spring — used for nearly every state change. */
export const spring: Transition = { type: "spring", stiffness: 300, damping: 30 };
export const springSoft: Transition = { type: "spring", stiffness: 210, damping: 26 };
export const springStiff: Transition = { type: "spring", stiffness: 420, damping: 32 };

/** Files "land" with a soft scale-down bounce. */
export const landSpring: Transition = { type: "spring", stiffness: 380, damping: 24 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Stagger container — children mount in sequence. */
export const stagger = (delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.02 } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16 } },
};

/** Route crossfade with a slight scale on the outgoing layer. */
export const routeTransition: Variants = {
  hidden: { opacity: 0, scale: 1.01 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 0.99, transition: { duration: 0.18 } },
};
