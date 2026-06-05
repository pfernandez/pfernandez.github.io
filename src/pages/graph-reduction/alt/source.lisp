; Basis-style program source.
; The compiler expands `define` and fully applied function calls into pair motifs
; that `observe` can expose one tick at a time.

(define (I x) x)
(define (K x y) x)
(define (S x y z) ((x z) (y z)))
(define (B f g x) (f (g x)))
(define (C f x y) ((f y) x))
(define (W f x) ((f x) x))

(define (true x y) x)
(define (false x y) y)

(define (const x y) x)
(define (if p th el) ((p th) el))
(define (not p x y) ((p y) x))
(define (and p q x y) ((p ((q x) y)) y))
(define (or p q x y) ((p x) ((q x) y)))

(define (pair a b f) (f a b))
(define (first p) (p true))
(define (second p) (p false))

(define (curry f x y) (f ((pair x) y)))
(define (uncurry f p) ((f (first p)) (second p)))

(define (left x y) x)
(define (right x y) y)
(define (self x) x)

(define (zero f x) x)
(define (one f x) (f x))
(define (two f x) (f (f x)))
(define (succ n f x) (f (n f x)))
(define (add m n f x) (m f (n f x)))
(define (mul m n f x) ((m (n f)) x))
(define (is-zero n a b) (n (K b) a))

(define (APPLY-SELF x v) ((x x) v))
(define (THETA f x) (f (APPLY-SELF x)))
(define apply-self APPLY-SELF)
(define theta THETA)

; Stateless fixed point: (lambda x. f (x x)) (lambda x. f (x x)).
(define (Y-THETA f x) (f (x x)))
(define (Y f) ((Y-THETA f) (Y-THETA f)))

(define (Z f) ((THETA f) (THETA f)))
(define fix Z)

(((S a) b) c)
