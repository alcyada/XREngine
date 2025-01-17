import assert from 'assert'
import { Mesh, MeshBasicMaterial } from 'three'

import { Entity } from '../../../ecs/classes/Entity'
import { getComponent } from '../../../ecs/functions/ComponentFunctions'
import { addComponent } from '../../../ecs/functions/ComponentFunctions'
import { createEntity } from '../../../ecs/functions/EntityFunctions'
import { createEngine } from '../../../initializeEngine'
import { Object3DComponent } from '../../components/Object3DComponent'
import { ShadowComponent, ShadowComponentType } from '../../components/ShadowComponent'
import { updateShadow } from './ShadowFunctions'

describe('ShadowFunctions', () => {
  let entity: Entity

  beforeEach(() => {
    createEngine()
    entity = createEntity()
  })

  const sceneComponentData = {
    cast: true,
    receive: true
  }

  describe('updateShadow()', () => {
    let shadowComponent: ShadowComponentType
    let obj3d: Mesh
    let child: Mesh

    beforeEach(() => {
      obj3d = new Mesh()
      child = new Mesh()

      obj3d.material = new MeshBasicMaterial()
      child.material = [new MeshBasicMaterial(), new MeshBasicMaterial()]

      obj3d.add(child)

      addComponent(entity, Object3DComponent, { value: obj3d })
      addComponent(entity, ShadowComponent, sceneComponentData)
      shadowComponent = getComponent(entity, ShadowComponent) as ShadowComponentType
    })

    describe('Property tests for "castShadow"', () => {
      it('should update shadow properties of the object', () => {
        shadowComponent.cast = false
        updateShadow(entity)
        obj3d.traverse((obj) => {
          assert(obj.castShadow === shadowComponent.cast)
        })

        shadowComponent.cast = true
        updateShadow(entity)
        obj3d.traverse((obj) => {
          assert(obj.castShadow === shadowComponent.cast)
        })
      })
    })

    describe('Property tests for "receiveShadow"', () => {
      it('should update shadow properties of the object', () => {
        shadowComponent.receive = false
        updateShadow(entity)
        obj3d.traverse((obj) => {
          assert(obj.receiveShadow === shadowComponent.receive)
        })

        shadowComponent.receive = true
        updateShadow(entity)
        obj3d.traverse((obj) => {
          assert(obj.receiveShadow === shadowComponent.receive)
        })
      })
    })
  })
})
