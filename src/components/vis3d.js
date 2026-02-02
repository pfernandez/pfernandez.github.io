import { appearance, box, material, scene,
         shape, transform, viewpoint, x3d } from '@pfern/elements/3d'
import { article, div, h2, p } from '@pfern/elements'

export const vis3d = () =>
  article(
    h2('X3DOM Starter'),
    p('A basic X3D scene rendered via X3DOM.'),
    div({ class: 'x3d-wrapper' },
        x3d({ showstat: 'true' },
            scene(
              viewpoint({ position: '0 0 6', description: 'Default View' }),
              transform({ id: 'cube-transform' },  // could use draw() as ontick
                        shape(
                          appearance(
                            material({ diffuseColor: '0.2 0.6 1.0' })),
                          box({ size: '1 1 1' })))))))

const draw = (id, fn) => {
  const updateScene = (t1, element, context) =>
    window.requestAnimationFrame(t2 => {
      const target = element ?? document.getElementById(id)
      const ready = target?.closest('x3d')?.runtime

      if (ready) {
        const dt = t2 - t1
        const nextContext = context ? { ...context, dt } : undefined
        updateScene(t2, target, fn(target, nextContext, dt))
      } else {
        updateScene(null, target, context)
      }
    })

  updateScene(null, null, undefined)
}

// Convert to ontick?
draw('cube-transform', (element, context = {
  rotation: 0
}, dt) => {
  const { rotation } = context

  // User does work here...
  element.setAttribute('rotation', `0 1 1 ${rotation}`)

  return {
    ...context,
    rotation: rotation + 0.001 * dt
  }
})

