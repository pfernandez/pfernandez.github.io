; Run with:
; node repl.mjs program.lisp

(defn A (x) (I x))
(defn T (x y) ((K (A x)) y))

((T a) b)
