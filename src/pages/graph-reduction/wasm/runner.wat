(module
  (import "host" "memory" (memory $memory 0))
  (import "host" "dispatch" (func $dispatch (param i32)))

  (export "memory" (memory $memory))

  ;; Expose the current state, follow its right edge, and continue forever.
  (func $run (export "run") (param $state i32)
    local.get $state
    call $dispatch

    local.get $state
    i32.load
    return_call $run))
