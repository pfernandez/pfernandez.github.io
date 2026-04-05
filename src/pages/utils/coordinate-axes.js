import { appearance, billboard, collision, cone, cylinder, fontStyle, group,
         material, shape, transform, x3dtext }
  from '@pfern/elements-x3dom'

export default () =>
  collision(
    { DEF: 'DoNotCollideWithVisualizationWidget' },
    group(
      group({ DEF: 'ArrowGreen' },
            shape(
              cylinder({ DEF: 'ArrowCylinder',
                         radius: '.025',
                         top: 'false' }),
              appearance({ DEF: 'Green' },
                         material({ diffuseColor: '.1 .6 .1',
                                    emissiveColor: '.05 .2 .05' }))),
            transform({ translation: '0 1 0' },
                      shape(
                        cone({ DEF: 'ArrowCone',
                               bottomRadius: '.05',
                               height: '.1' }),
                        appearance({ USE: 'Green' })))),
      transform({ translation: '0 1.08 0' },
                billboard(
                  shape(
                    appearance({ DEF: 'LABEL_APPEARANCE' },
                               material({ diffuseColor: '0 0 0',
                                          transparency: 0.3 })),
                    x3dtext({ string: '"Y"' },
                            fontStyle({ DEF: 'LABEL_FONT',
                                        family: '"SANS"',
                                        justify: '"MIDDLE" "MIDDLE"',
                                        size: '.2' })))))),

    transform(
      { rotation: '0 0 1 -1.57079' },
      group(
        group({ DEF: 'ArrowRed' },
              shape(
                cylinder({ USE: 'ArrowCylinder' }),
                appearance({ DEF: 'Red' },
                           material({ diffuseColor: '.7 .1 .1',
                                      emissiveColor: '.33 0 0' }))),
              transform({ translation: '0 1 0' },
                        shape(
                          cone({ USE: 'ArrowCone' }),
                          appearance({ USE: 'Red' })))),
        transform({ rotation: '0 0 1 1.57079',
                    translation: '.072 1.1 0' },
                  billboard(
                    shape(
                      appearance({ USE: 'LABEL_APPEARANCE' }),
                      x3dtext({ string: '"X"' },
                              fontStyle({ USE: 'LABEL_FONT' }))))))),
    transform(
      { rotation: '1 0 0 1.57079' },
      group(
        group({ DEF: 'ArrowBlue' },
              shape(
                cylinder({ USE: 'ArrowCylinder' }),
                appearance({ DEF: 'Blue' },
                           material({ diffuseColor: '.3 .3 1',
                                      emissiveColor: '.1 .1 .33' }))),
              transform(
                { translation: '0 1 0' },
                shape(
                  cone({ USE: 'ArrowCone' }),
                  appearance({ USE: 'Blue' })))),
        transform(
          { rotation: '1 0 0 -1.57079', translation: '0 1.1 .072' },
          billboard(
            shape(
              appearance({ USE: 'LABEL_APPEARANCE' }),
              x3dtext({ string: '"Z"' },
                      fontStyle({ USE: 'LABEL_FONT' }))))))))

