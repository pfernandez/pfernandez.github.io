import { appearance, box, material, scene,
         shape, transform, viewpoint, x3d } from '@pfern/elements/3d'
import { article, div, h2, p } from '@pfern/elements'

export const vis3d = () =>
  article(
    h2('X3DOM Starter'),
    p('A basic X3D scene rendered via X3DOM.'),
    div({ class: 'x3d-wrapper' },
        x3d(
          scene(
            viewpoint({ position: '0 0 6', description: 'Default View' }),
            transform({ id: 'cube-transform' },
                      shape(
                        appearance(
                          material({ diffuseColor: '0.2 0.6 1.0' })),
                        box()))))))

let cubeTransform, rotation = 0

const updateScene = _timestamp => {
  // Update rotation value based on time delta for smooth animation
  rotation += 0.01

  if (!cubeTransform) {
    cubeTransform = document.getElementById('cube-transform')
  } else {
    cubeTransform.setAttribute('rotation', `0 1 1 ${rotation}`)
  }

  // Continue the loop
  window.requestAnimationFrame(updateScene)
}

// Start the animation loop
window?.requestAnimationFrame(updateScene)
