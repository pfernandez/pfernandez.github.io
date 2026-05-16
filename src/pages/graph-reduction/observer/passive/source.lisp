; Basis-style program source.
; The compiler expands `def` and fully applied `defn` forms into pair motifs
; that `observe` can expose one tick at a time.

(defn I (x) x)
(defn first (x y) x)
(defn second (x y) y)
(defn share (x y z) ((x z) (y z)))

(defn if (p x y) ((p x) y))
(def not (p x y) ((p y) x))
(defn and (p q x y) ((p ((q x) y)) y))
(defn or (p q x y) ((p x) ((q x) y)))

(defn pair (a b) (a b))
(defn first (p) (true p))
(defn second (p) (false p))

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

; Stateless fixed point: (lambda x. f (x x)) (lambda x. f (x x)).
(defn Y-THETA (f x) (f (x x)))
(defn Y (f) ((Y-THETA f) (Y-THETA f)))

(defn Z (f) ((THETA f) (THETA f)))
(def fix Z)

(((S a) b) c)
