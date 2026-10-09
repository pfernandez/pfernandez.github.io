; A signal selects the current or next state supplied by its receiver.
((hold (hold hold))
 (advance (advance advance))
 (ports (hold advance))
 (quiet (ports hold))
 (pulse (ports advance))

 (zero (zero zero))
 (one (one one))

; One bit toggles on each clock. Its 1-to-0 transition emits a carry.
 (off-output (zero quiet))
 (on-output (one pulse))
 (off (off-output on))
 (on (on-output off))

; Two positions, low then high, share the same component graph.
 (initial (off off)))
