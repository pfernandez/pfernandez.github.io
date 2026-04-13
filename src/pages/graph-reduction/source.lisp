; Basis-style program source.
; The parser expands `def` and `defn` forms, then lowers the final expression
; into the pair-only motif language used by this page.

(defn I (x) x)
(def id I)

(defn K (x y) x)
(def const K)

(defn S (x y z) ((x z) (y z)))
(def spread S)

(defn B (f g x) (f (g x)))
(def compose B)

(defn C (f x y) ((f y) x))
(def flip C)

(defn W (f x) ((f x) x))
(def split W)

(defn true (x y) x)
(defn false (x y) y)

(defn if (p th el) ((p th) el))
(defn not (p x y) ((p y) x))
(defn and (p q x y) ((p ((q x) y)) y))
(defn or (p q x y) ((p x) ((q x) y)))

(defn pair (a b f) ((f a) b))
(defn first (p) (p true))
(defn second (p) (p false))

(defn curry (f x y) (f ((pair x) y)))
(defn uncurry (f p) ((f (first p)) (second p)))

(defn left (x y) x)
(defn right (x y) y)
(defn self (x) x)

(defn zero (f x) x)
(defn one (f x) (f x))
(defn two (f x) (f (f x)))
(defn succ (n f x) (f ((n f) x)))
(defn add (m n f x) ((m f) ((n f) x)))
(defn mul (m n f x) ((m (n f)) x))
(defn is-zero (n) ((n (const false)) true))

(defn APPLY-SELF (x v) ((x x) v))
(defn THETA (f x) (f (APPLY-SELF x)))
(def apply-self APPLY-SELF)
(def theta THETA)

(defn Z (f) ((THETA f) (THETA f)))
(def fix Z)

; Try:
; (((S a) b) c)
; (((pair a) b) left)
; ((((add one) two) f) x)

(((S a) b) c)
