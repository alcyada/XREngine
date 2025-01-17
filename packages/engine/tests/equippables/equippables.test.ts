import { RigidBodyType, ShapeType } from '@dimforge/rapier3d-compat'
import assert from 'assert'
import { Mesh, MeshNormalMaterial, Quaternion, SphereBufferGeometry, Vector3 } from 'three'

import { NetworkId } from '@xrengine/common/src/interfaces/NetworkId'
import { UserId } from '@xrengine/common/src/interfaces/UserId'
import ActionFunctions from '@xrengine/hyperflux/functions/ActionFunctions'

import { Engine } from '../../src/ecs/classes/Engine'
import { addComponent, getComponent, hasComponent } from '../../src/ecs/functions/ComponentFunctions'
import { createEntity } from '../../src/ecs/functions/EntityFunctions'
import { createEngine } from '../../src/initializeEngine'
import { EquippedComponent } from '../../src/interaction/components/EquippedComponent'
import { EquipperComponent } from '../../src/interaction/components/EquipperComponent'
import { equipEntity, unequipEntity } from '../../src/interaction/functions/equippableFunctions'
import { equipperQueryExit } from '../../src/interaction/systems/EquippableSystem'
import { NetworkObjectComponent } from '../../src/networking/components/NetworkObjectComponent'
import { Physics } from '../../src/physics/classes/Physics'
import { Object3DComponent } from '../../src/scene/components/Object3DComponent'
import { TransformComponent } from '../../src/transform/components/TransformComponent'
import { createMockNetwork } from '../util/createMockNetwork'

describe.skip('Equippables Integration Tests', () => {
  beforeEach(async () => {
    createEngine()
    createMockNetwork()
    await Physics.load()
    Engine.instance.currentWorld.physicsWorld = Physics.createWorld()
  })

  it('Can equip and unequip', async () => {
    const world = Engine.instance.currentWorld

    const hostUserId = 'world' as UserId
    world.worldNetwork.hostId = hostUserId
    const hostIndex = 0

    world.worldNetwork.peers.set(hostUserId, { userId: hostUserId, index: hostIndex })

    const userId = 'user id' as UserId
    const userName = 'user name'
    const userIndex = 1
    Engine.instance.userId = userId

    const equippableEntity = createEntity()

    const transform = addComponent(equippableEntity, TransformComponent, {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3()
    })

    // physics mock stuff
    const type = ShapeType.Cuboid
    const geom = new SphereBufferGeometry()

    const mesh = new Mesh(geom, new MeshNormalMaterial())
    const bodyOptions = {
      type,
      bodyType: RigidBodyType.Dynamic
    }
    mesh.userData = bodyOptions

    const object3d = addComponent(equippableEntity, Object3DComponent, {
      value: mesh
    })
    Physics.createRigidBodyForObject(equippableEntity, world.physicsWorld, mesh, bodyOptions)
    // network mock stuff
    // initially the object is owned by server
    const networkObject = addComponent(equippableEntity, NetworkObjectComponent, {
      ownerId: world.worldNetwork.hostId,
      authorityUserId: world.worldNetwork.hostId,
      networkId: 0 as NetworkId
    })

    // Equipper
    const equipperEntity = createEntity()
    addComponent(equipperEntity, TransformComponent, {
      position: new Vector3(2, 0, 0),
      rotation: new Quaternion(),
      scale: new Vector3()
    })

    equipEntity(equipperEntity, equippableEntity, undefined)

    // world.receptors.push(
    //     (a) => matches(a).when(WorldNetworkAction.setEquippedObject.matches, setEquippedObjectReceptor)
    // )
    ActionFunctions.clearOutgoingActions()
    ActionFunctions.applyIncomingActions()

    // equipperQueryEnter(equipperEntity)

    // validations for equip
    assert(hasComponent(equipperEntity, EquipperComponent))
    const equipperComponent = getComponent(equipperEntity, EquipperComponent)
    assert.equal(equippableEntity, equipperComponent.equippedEntity)
    // assert(hasComponent(equippableEntity, NetworkObjectAuthorityTag))
    assert(hasComponent(equippableEntity, EquippedComponent))

    // unequip stuff
    unequipEntity(equipperEntity)

    ActionFunctions.clearOutgoingActions()
    ActionFunctions.applyIncomingActions()

    equipperQueryExit(equipperEntity)

    // validations for unequip
    assert(!hasComponent(equipperEntity, EquipperComponent))
    // assert(!hasComponent(equippableEntity, NetworkObjectAuthorityTag))
    assert(!hasComponent(equippableEntity, EquippedComponent))
  })
})
