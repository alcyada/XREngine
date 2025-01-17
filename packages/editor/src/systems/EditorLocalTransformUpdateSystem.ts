import { World } from '@xrengine/engine/src/ecs/classes/World'
import { hasComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import obj3dFromUuid from '@xrengine/engine/src/scene/util/obj3dFromUuid'
import {
  LocalTransformComponent,
  updateLocalTransformComponentFromParent
} from '@xrengine/engine/src/transform/components/LocalTransformComponent'
import { createActionQueue } from '@xrengine/hyperflux'

import { SelectionAction } from '../services/SelectionServices'

export default async function EditorLocalTransformUpdateSystem(world: World) {
  const changedObjectActionQueue = createActionQueue(SelectionAction.changedObject.matches)

  return () => {
    for (const action of changedObjectActionQueue()) {
      if (action.propertyName === 'position' || action.propertyName === 'rotation' || action.propertyName === 'scale') {
        for (const obj of action.objects) {
          if (typeof obj === 'string') {
            /*const obj3d = obj3dFromUuid(obj)
            const parent = obj3d.parent
            if (parent) {
              updateLocalTransformComponentFromParent(parent, obj3d)
            }*/
          } else {
            if (hasComponent(obj.entity, LocalTransformComponent)) {
              const parentEntity = world.entityTree.entityNodeMap.get(obj.entity)?.parentEntity
              if (parentEntity) {
                updateLocalTransformComponentFromParent(parentEntity, obj.entity)
              }
            }
          }
        }
      }
    }
  }
}
