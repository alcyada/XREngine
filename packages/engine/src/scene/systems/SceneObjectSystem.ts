import { BufferGeometry, Material, Mesh, Vector3 } from 'three'

import { createActionQueue, getState } from '@xrengine/hyperflux'

import { loadDRACODecoder } from '../../assets/loaders/gltf/NodeDracoLoader'
import { isNode } from '../../common/functions/getEnvironment'
import { isClient } from '../../common/functions/isClient'
import { Engine } from '../../ecs/classes/Engine'
import { EngineActions, EngineState, getEngineState } from '../../ecs/classes/EngineState'
import { Entity } from '../../ecs/classes/Entity'
import { World } from '../../ecs/classes/World'
import { defineQuery, getComponent, hasComponent } from '../../ecs/functions/ComponentFunctions'
import { XRUIComponent } from '../../xrui/components/XRUIComponent'
import { NameComponent } from '../components/NameComponent'
import { Object3DComponent } from '../components/Object3DComponent'
import { ShadowComponent } from '../components/ShadowComponent'
import { SimpleMaterialTagComponent } from '../components/SimpleMaterialTagComponent'
import { UpdatableComponent } from '../components/UpdatableComponent'
import { useSimpleMaterial, useStandardMaterial } from '../functions/loaders/SimpleMaterialFunctions'
import { reparentObject3D } from '../functions/ReparentFunction'
import { Updatable } from '../interfaces/Updatable'

type BPCEMProps = {
  bakeScale: Vector3
  bakePositionOffset: Vector3
}

export class SceneOptions {
  static instance: SceneOptions
  bpcemOptions: BPCEMProps = {
    bakeScale: new Vector3(1, 1, 1),
    bakePositionOffset: new Vector3()
  }
  envMapIntensity = 1
  boxProjection = false
}

const processObject3d = (entity: Entity) => {
  if (!isClient) return

  const object3DComponent = getComponent(entity, Object3DComponent)
  const shadowComponent = getComponent(entity, ShadowComponent)
  object3DComponent.value.name = getComponent(entity, NameComponent)?.name ?? ''

  object3DComponent.value.traverse((obj: Mesh<any, Material>) => {
    const material = obj.material
    if (typeof material !== 'undefined') material.dithering = true

    if (shadowComponent) {
      obj.receiveShadow = shadowComponent.receive
      obj.castShadow = shadowComponent.cast
    }
  })

  updateSimpleMaterials([entity])
}

const updateSimpleMaterials = (sceneObjectEntities: Entity[]) => {
  for (const entity of sceneObjectEntities) {
    const obj3d = getComponent(entity, Object3DComponent)
    if (hasComponent(entity, XRUIComponent)) return

    const simpleMaterials =
      hasComponent(entity, SimpleMaterialTagComponent) || getEngineState().useSimpleMaterials.value

    let abort = false

    obj3d.value.traverse((obj: any) => {
      if (abort || (obj.entity && hasComponent(entity, XRUIComponent))) {
        abort = true
        return
      }
      if (simpleMaterials) {
        useSimpleMaterial(obj)
      } else {
        useStandardMaterial(obj)
      }
    })
  }
}

export default async function SceneObjectSystem(world: World) {
  SceneOptions.instance = new SceneOptions()
  if (isNode) {
    await loadDRACODecoder()
  }

  const sceneObjectQuery = defineQuery([Object3DComponent])
  const updatableQuery = defineQuery([Object3DComponent, UpdatableComponent])

  const useSimpleMaterialsActionQueue = createActionQueue(EngineActions.useSimpleMaterials.matches)

  return () => {
    for (const entity of sceneObjectQuery.exit()) {
      const obj3d = getComponent(entity, Object3DComponent, true).value as Mesh

      if (obj3d.parent === Engine.instance.currentWorld.scene) obj3d.removeFromParent()

      const layers = Object.values(Engine.instance.currentWorld.objectLayerList)
      for (const layer of layers) {
        if (layer.has(obj3d)) layer.delete(obj3d)
      }
      obj3d.traverse((mesh: Mesh) => {
        if (typeof (mesh.material as Material)?.dispose === 'function') (mesh.material as Material)?.dispose()
        if (typeof (mesh.geometry as BufferGeometry)?.dispose === 'function')
          (mesh.geometry as BufferGeometry)?.dispose()
      })
    }

    for (const entity of sceneObjectQuery.enter()) {
      if (!hasComponent(entity, Object3DComponent)) return // may have been since removed
      const { value } = getComponent(entity, Object3DComponent)
      // @ts-ignore
      value.entity = entity

      const node = world.entityTree.entityNodeMap.get(entity)
      if (node) {
        if (node.parentEntity) reparentObject3D(node, node.parentEntity, undefined, world.entityTree)
      } else {
        const scene = Engine.instance.currentWorld.scene
        let isInScene = false
        value.traverseAncestors((ancestor) => {
          if (ancestor === scene) {
            isInScene = true
          }
        })
        if (!isInScene) scene.add(value)
      }

      processObject3d(entity)
    }

    for (const action of useSimpleMaterialsActionQueue()) {
      const sceneObjectEntities = sceneObjectQuery()
      updateSimpleMaterials(sceneObjectEntities)
    }

    const fixedDelta = getState(EngineState).fixedDeltaSeconds.value
    for (const entity of updatableQuery()) {
      const obj = getComponent(entity, Object3DComponent)?.value as unknown as Updatable
      obj?.update(fixedDelta)
    }
  }
}
