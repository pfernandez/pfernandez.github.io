; Comments before forms are ignored.

(defn choose
  (x y) ; inline comment after params
  x)

; Newlines inside applications are fine.
((
  choose
  a ; first argument
 )
 b)
