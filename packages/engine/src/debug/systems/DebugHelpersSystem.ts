import {
  ArrowHelper,
  Box3Helper,
  BoxBufferGeometry,
  BoxHelper,
  Camera,
  CameraHelper,
  Color,
  ConeBufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  PlaneBufferGeometry,
  Quaternion,
  SkeletonHelper,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from 'three'

import { createActionQueue, getState } from '@xrengine/hyperflux'

import { AssetLoader } from '../../assets/classes/AssetLoader'
import { AudioComponent } from '../../audio/components/AudioComponent'
import { AudioElementNodes } from '../../audio/systems/AudioSystem'
import { AvatarAnimationComponent } from '../../avatar/components/AvatarAnimationComponent'
import { AvatarPendingComponent } from '../../avatar/components/AvatarPendingComponent'
import { Engine } from '../../ecs/classes/Engine'
import { Entity } from '../../ecs/classes/Entity'
import { World } from '../../ecs/classes/World'
import { defineQuery, getComponent, hasComponent } from '../../ecs/functions/ComponentFunctions'
import { BoundingBoxComponent } from '../../interaction/components/BoundingBoxComponents'
import { NavMeshComponent } from '../../navigation/component/NavMeshComponent'
import { createGraphHelper } from '../../navigation/GraphHelper'
import { createConvexRegionHelper } from '../../navigation/NavMeshHelper'
import { EngineRendererAction, EngineRendererState } from '../../renderer/EngineRendererState'
import EditorDirectionalLightHelper from '../../scene/classes/EditorDirectionalLightHelper'
import InfiniteGridHelper from '../../scene/classes/InfiniteGridHelper'
import Spline from '../../scene/classes/Spline'
import { DirectionalLightComponent } from '../../scene/components/DirectionalLightComponent'
import { EnvMapBakeComponent } from '../../scene/components/EnvMapBakeComponent'
import { MediaElementComponent } from '../../scene/components/MediaElementComponent'
import { MountPointComponent } from '../../scene/components/MountPointComponent'
import { Object3DComponent } from '../../scene/components/Object3DComponent'
import { PointLightComponent } from '../../scene/components/PointLightComponent'
import { PortalComponent } from '../../scene/components/PortalComponent'
import { ScenePreviewCameraTagComponent } from '../../scene/components/ScenePreviewCamera'
import { SelectTagComponent } from '../../scene/components/SelectTagComponent'
import { SpawnPointComponent } from '../../scene/components/SpawnPointComponent'
import { SplineComponent } from '../../scene/components/SplineComponent'
import { SpotLightComponent } from '../../scene/components/SpotLightComponent'
import { ObjectLayers } from '../../scene/constants/ObjectLayers'
import { setObjectLayers } from '../../scene/functions/setObjectLayers'
import { TransformComponent } from '../../transform/components/TransformComponent'
import { XRInputSourceComponent } from '../../xr/XRComponents'
import { DebugNavMeshComponent } from '../DebugNavMeshComponent'
import { PositionalAudioHelper } from '../PositionalAudioHelper'
import { DebugRenderer } from './DebugRenderer'

const vector3 = new Vector3()
const quat = new Quaternion()

const cubeGeometry = new ConeBufferGeometry(0.05, 0.25, 4)
cubeGeometry.rotateX(-Math.PI * 0.5)

const AUDIO_TEXTURE_PATH = '/static/editor/audio-icon.png'
const GLTF_PATH = '/static/editor/spawn-point.glb'

export default async function DebugHelpersSystem(world: World) {
  InfiniteGridHelper.instance = new InfiniteGridHelper()
  Engine.instance.currentWorld.scene.add(InfiniteGridHelper.instance)

  const [AUDIO_HELPER_TEXTURE, { scene: spawnPointHelperModel }] = await Promise.all([
    AssetLoader.loadAsync(AUDIO_TEXTURE_PATH),
    AssetLoader.loadAsync(GLTF_PATH)
  ])

  spawnPointHelperModel.traverse((obj) => (obj.castShadow = true))

  const physicsDebugRenderer = DebugRenderer()

  const editorHelpers = new Map<Entity, Object3D>()
  const editorStaticHelpers = new Map<Entity, Object3D>()

  const helpersByEntity = {
    skeletonHelpers: new Map(),
    ikExtents: new Map(),
    box: new Map<Entity, Box3Helper>(),
    navmesh: new Map(),
    navpath: new Map(),
    positionalAudioHelper: new Map()
  }
  const directionalLightQuery = defineQuery([DirectionalLightComponent, Object3DComponent])
  const pointLightQuery = defineQuery([PointLightComponent, Object3DComponent])
  const spotLightQuery = defineQuery([SpotLightComponent, Object3DComponent])
  const portalQuery = defineQuery([PortalComponent])
  const splineQuery = defineQuery([SplineComponent])
  const spawnPointQuery = defineQuery([SpawnPointComponent])
  const mountPointQuery = defineQuery([MountPointComponent])
  const envMapBakeQuery = defineQuery([EnvMapBakeComponent])
  const directionalLightSelectQuery = defineQuery([DirectionalLightComponent, Object3DComponent, SelectTagComponent])
  const scenePreviewCameraSelectQuery = defineQuery([
    ScenePreviewCameraTagComponent,
    Object3DComponent,
    SelectTagComponent
  ])

  const boundingBoxQuery = defineQuery([Object3DComponent, BoundingBoxComponent])
  const ikAvatarQuery = defineQuery([XRInputSourceComponent])
  const avatarAnimationQuery = defineQuery([Object3DComponent, AvatarAnimationComponent])
  const navmeshQuery = defineQuery([DebugNavMeshComponent, NavMeshComponent])
  const audioHelper = defineQuery([AudioComponent])
  // const navpathQuery = defineQuery([AutoPilotComponent])
  // const navpathAddQuery = enterQuery(navpathQuery)
  // const navpathRemoveQuery = exitQuery(navpathQuery)

  function physicsDebugUpdate(physicsDebugEnable: boolean) {
    for (const [_entity, helper] of helpersByEntity.box) {
      helper.visible = physicsDebugEnable
    }
  }

  const debugActionQueue = createActionQueue(EngineRendererAction.setDebug.matches)

  return () => {
    for (const action of debugActionQueue()) physicsDebugUpdate(action.debugEnable)
    const debugEnabled = getState(EngineRendererState).debugEnable.value

    /**
     * EDITOR GIZMOS
     * @todo refactor this modularly (these queries should be in the system that loads the associated component)
     */
    if (Engine.instance.isEditor) {
      /**
       * Directional Light
       */
      for (const entity of directionalLightQuery.enter()) {
        const helper = new EditorDirectionalLightHelper(
          getComponent(entity, Object3DComponent).value as DirectionalLight
        )
        helper.visible = true
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)

        // const cameraHelper = new CameraHelper(light.shadow.camera)
        // cameraHelper.visible = false
        // light.userData.cameraHelper = cameraHelper
        // setObjectLayers(cameraHelper, ObjectLayers.NodeHelper)
      }

      for (const entity of directionalLightQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      for (const entity of directionalLightSelectQuery.exit()) {
        const light = getComponent(entity, Object3DComponent)?.value as DirectionalLight
        if (light) light.userData.cameraHelper.visible = false
      }

      for (const entity of directionalLightSelectQuery()) {
        const helper = editorHelpers.get(entity)! as EditorDirectionalLightHelper
        helper.update()
        // light.userData.cameraHelper.update()
      }

      /**
       * Point Light
       */
      for (const entity of pointLightQuery.enter()) {
        const helper = new Object3D()

        const ball = new Mesh(new IcosahedronGeometry(0.15), new MeshBasicMaterial({ fog: false }))
        const rangeBall = new Mesh(
          new IcosahedronGeometry(0.25),
          new MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.5 })
        )
        helper.add(rangeBall, ball)

        setObjectLayers(helper, ObjectLayers.NodeHelper)

        editorHelpers.set(entity, helper)
        Engine.instance.currentWorld.scene.add(helper)
      }

      for (const entity of pointLightQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Spot Light
       */

      for (const entity of spotLightQuery.enter()) {
        const helper = new Object3D()

        const ring = new Mesh(new TorusGeometry(0.1, 0.025, 8, 12), new MeshBasicMaterial({ fog: false }))
        const cone = new Mesh(
          new ConeGeometry(0.25, 0.5, 8, 1, true),
          new MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.5, side: DoubleSide })
        )
        helper.add(ring, cone)

        ring.rotateX(Math.PI / 2)
        cone.position.setY(-0.25)

        setObjectLayers(helper, ObjectLayers.NodeHelper)

        editorHelpers.set(entity, helper)
        Engine.instance.currentWorld.scene.add(helper)
      }

      for (const entity of spotLightQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      for (const entity of spotLightQuery()) {
        const component = getComponent(entity, SpotLightComponent)
        const helper = editorHelpers.get(entity)! as any
        helper.children[0].material.color = component.color
        helper.children[0].material.color = component.color
      }

      /**
       * Scene Preview Camera
       */

      for (const entity of scenePreviewCameraSelectQuery.enter()) {
        const camera = getComponent(entity, Object3DComponent)?.value as Camera
        const helper = new CameraHelper(camera)
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        editorHelpers.set(entity, helper)
        Engine.instance.currentWorld.scene.add(helper)
      }

      for (const entity of scenePreviewCameraSelectQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Audio Helper
       */

      for (const entity of audioHelper.enter()) {
        const helper = new Mesh(
          new PlaneBufferGeometry(),
          new MeshBasicMaterial({ transparent: true, side: DoubleSide })
        )
        helper.material.map = AUDIO_HELPER_TEXTURE
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)
      }

      for (const entity of audioHelper.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Env Map Bake
       */

      for (const entity of envMapBakeQuery.enter()) {
        const helper = new Object3D()

        helper.userData.centerBall = new Mesh(
          new SphereGeometry(0.75),
          new MeshPhysicalMaterial({ roughness: 0, metalness: 1 })
        )
        helper.add(helper.userData.centerBall)

        helper.userData.gizmo = new BoxHelper(new Mesh(new BoxBufferGeometry()), 0xff0000)
        helper.add(helper.userData.gizmo)

        setObjectLayers(helper, ObjectLayers.NodeHelper)

        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)
      }

      for (const entity of envMapBakeQuery()) {
        const helper = editorHelpers.get(entity)!
        const bakeComponent = getComponent(entity, EnvMapBakeComponent)
        if (helper.userData.gizmo)
          helper.userData.gizmo.matrix.compose(bakeComponent.bakePositionOffset, quat, bakeComponent.bakeScale)
      }

      for (const entity of envMapBakeQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Mount Point
       */

      for (const entity of mountPointQuery.enter()) {
        const helper = new ArrowHelper(new Vector3(0, 0, 1), new Vector3(0, 0, 0), 0.5, 0xffffff)
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)
      }

      for (const entity of mountPointQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Portals
       */

      for (const entity of portalQuery.enter()) {
        const helper = new Mesh(
          new CylinderGeometry(0.25, 0.25, 0.1, 6, 1, false, (30 * Math.PI) / 180),
          new MeshBasicMaterial({ color: 0x2b59c3 })
        )

        const spawnDirection = new Mesh(
          new ConeGeometry(0.05, 0.5, 4, 1, false, Math.PI / 4),
          new MeshBasicMaterial({ color: 0xd36582 })
        )
        spawnDirection.position.set(0, 0, 1.25)
        spawnDirection.rotateX(Math.PI / 2)
        helper.add(spawnDirection)

        setObjectLayers(helper, ObjectLayers.NodeHelper)

        Engine.instance.currentWorld.scene.add(helper)
        editorStaticHelpers.set(entity, helper)
      }

      for (const entity of portalQuery.exit()) {
        const helper = editorStaticHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorStaticHelpers.delete(entity)
      }

      for (const entity of portalQuery()) {
        const portalComponent = getComponent(entity, PortalComponent)
        const helper = editorStaticHelpers.get(entity)!
        helper.position.copy(portalComponent.spawnPosition)
        helper.quaternion.copy(portalComponent.spawnRotation)
      }

      /**
       * Spawn Point
       */

      for (const entity of spawnPointQuery.enter()) {
        const helper = spawnPointHelperModel.clone()
        const helperBox = new BoxHelper(new Mesh(new BoxBufferGeometry(1, 0, 1)), 0xffffff)
        helper.userData.helperBox = helperBox
        helper.add(helperBox)
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)
      }

      for (const entity of spawnPointQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      for (const entity of spawnPointQuery()) {
        const helper = editorHelpers.get(entity)!
        const transform = getComponent(entity, TransformComponent)
        helper.userData.helperBox.object.scale.copy(transform.scale)
        helper.userData.helperBox.update()
      }

      /**
       * Spline
       */

      for (const entity of splineQuery.enter()) {
        const spline = getComponent(entity, SplineComponent)
        const helper = new Spline()
        helper.init(spline.splinePositions)
        setObjectLayers(helper, ObjectLayers.NodeHelper)
        Engine.instance.currentWorld.scene.add(helper)
        editorHelpers.set(entity, helper)
      }

      for (const entity of splineQuery.exit()) {
        const helper = editorHelpers.get(entity)!
        Engine.instance.currentWorld.scene.remove(helper)
        editorHelpers.delete(entity)
      }

      /**
       * Update helper positions
       */

      for (const [entity, helper] of editorHelpers) {
        const transform = getComponent(entity, TransformComponent)
        if (!transform) continue
        helper.position.copy(transform.position)
        helper.quaternion.copy(transform.rotation)
      }
    }

    /**
     * AVATAR HELPERS
     */
    for (const entity of avatarAnimationQuery()) {
      const anim = getComponent(entity, AvatarAnimationComponent)
      if (
        !helpersByEntity.skeletonHelpers.has(entity) &&
        debugEnabled &&
        !hasComponent(entity, AvatarPendingComponent)
      ) {
        const helper = new SkeletonHelper(anim.rig.Hips)
        Engine.instance.currentWorld.scene.add(helper)
        helpersByEntity.skeletonHelpers.set(entity, helper)
      }
      if (
        helpersByEntity.skeletonHelpers.has(entity) &&
        (!debugEnabled || hasComponent(entity, AvatarPendingComponent))
      ) {
        const helper = helpersByEntity.skeletonHelpers.get(entity) as SkeletonHelper
        Engine.instance.currentWorld.scene.remove(helper)
        helpersByEntity.skeletonHelpers.delete(entity)
      }
    }

    for (const entity of avatarAnimationQuery.exit()) {
      const helper = helpersByEntity.skeletonHelpers.get(entity) as SkeletonHelper
      if (helper) {
        Engine.instance.currentWorld.scene.remove(helper)
        helpersByEntity.skeletonHelpers.delete(entity)
      }
    }

    for (const entity of ikAvatarQuery()) {
      if (debugEnabled) {
        if (!helpersByEntity.ikExtents.has(entity)) {
          const debugHead = new Mesh(cubeGeometry, new MeshBasicMaterial({ color: new Color('red'), side: DoubleSide }))
          const debugLeft = new Mesh(cubeGeometry, new MeshBasicMaterial({ color: new Color('yellow') }))
          const debugRight = new Mesh(cubeGeometry, new MeshBasicMaterial({ color: new Color('blue') }))
          debugHead.visible = debugEnabled
          debugLeft.visible = debugEnabled
          debugRight.visible = debugEnabled
          Engine.instance.currentWorld.scene.add(debugHead)
          Engine.instance.currentWorld.scene.add(debugLeft)
          Engine.instance.currentWorld.scene.add(debugRight)
          helpersByEntity.ikExtents.set(entity, [debugHead, debugLeft, debugRight])
        }
        const xrInputSourceComponent = getComponent(entity, XRInputSourceComponent)
        const [debugHead, debugLeft, debugRight] = helpersByEntity.ikExtents.get(entity) as Object3D[]
        debugHead.position.copy(xrInputSourceComponent.head.getWorldPosition(vector3))
        debugHead.quaternion.copy(xrInputSourceComponent.head.getWorldQuaternion(quat))
        debugLeft.position.copy(xrInputSourceComponent.controllerLeft.getWorldPosition(vector3))
        debugLeft.quaternion.copy(xrInputSourceComponent.controllerLeft.getWorldQuaternion(quat))
        debugRight.position.copy(xrInputSourceComponent.controllerRight.getWorldPosition(vector3))
        debugRight.quaternion.copy(xrInputSourceComponent.controllerRight.getWorldQuaternion(quat))
      } else {
        if (helpersByEntity.ikExtents.has(entity)) {
          ;(helpersByEntity.ikExtents.get(entity) as Object3D[]).forEach((obj: Object3D) => {
            obj.removeFromParent()
          })
          helpersByEntity.ikExtents.delete(entity)
        }
      }
    }

    for (const entity of ikAvatarQuery.exit()) {
      if (helpersByEntity.ikExtents.has(entity)) {
        ;(helpersByEntity.ikExtents.get(entity) as Object3D[]).forEach((obj: Object3D) => {
          obj.removeFromParent()
        })
        helpersByEntity.ikExtents.delete(entity)
      }
    }

    /**
     * DEBUG HELPERS
     */

    for (const entity of boundingBoxQuery.exit()) {
      const boxHelper = helpersByEntity.box.get(entity) as Box3Helper
      boxHelper.removeFromParent()
      helpersByEntity.box.delete(entity)
    }

    for (const entity of boundingBoxQuery.enter()) {
      const boundingBox = getComponent(entity, BoundingBoxComponent)
      const helper = new Box3Helper(boundingBox.box)
      setObjectLayers(helper, ObjectLayers.NodeHelper)
      helpersByEntity.box.set(entity, helper)
      Engine.instance.currentWorld.scene.add(helper)
      helper.visible = debugEnabled
    }

    // ===== NAVMESH Helper ===== //
    for (const entity of navmeshQuery.enter()) {
      console.log('add navmesh helper!')
      const navMesh = getComponent(entity, NavMeshComponent)?.yukaNavMesh
      const convexHelper = createConvexRegionHelper(navMesh)
      const graphHelper = createGraphHelper(navMesh!.graph, 0.2)
      const helper = new Group()
      helper.add(convexHelper)
      helper.add(graphHelper)
      console.log('navhelper', helper)
      Engine.instance.currentWorld.scene.add(helper)
      helpersByEntity.navmesh.set(entity, helper)
    }

    for (const entity of navmeshQuery.exit()) {
      const helper = helpersByEntity.navmesh.get(entity) as Object3D
      Engine.instance.currentWorld.scene.remove(helper)
      helpersByEntity.navmesh.delete(entity)
    }

    if (debugEnabled)
      for (const entity of navmeshQuery()) {
        // update
        const helper = helpersByEntity.navmesh.get(entity) as Object3D
        const transform = getComponent(entity, TransformComponent)
        helper.position.copy(transform.position)
        // helper.quaternion.copy(transform.rotation)
      }
    // ===== Autopilot Helper ===== //
    // TODO add createPathHelper for navpathQuery

    // todo refactor this
    if (Engine.instance.isEditor) {
      for (const entity of audioHelper.exit()) {
        const helper = helpersByEntity.positionalAudioHelper.get(entity)
        helper.dispose()
        helpersByEntity.positionalAudioHelper.delete(entity)
        Engine.instance.currentWorld.scene.remove(helper)
      }

      if (debugEnabled)
        for (const entity of audioHelper()) {
          const mediaComponent = getComponent(entity, MediaElementComponent)
          const audioEl = AudioElementNodes.get(mediaComponent)
          if (!audioEl) continue

          if (!helpersByEntity.positionalAudioHelper.has(entity)) {
            const helper = new PositionalAudioHelper(audioEl)
            // helper.visible = false
            helpersByEntity.positionalAudioHelper.set(entity, helper)
            Engine.instance.currentWorld.scene.add(helper)
          }

          const helper = helpersByEntity.positionalAudioHelper.get(entity)
          audioEl.panner && helper?.update()
          helper?.position.copy(getComponent(entity, TransformComponent).position)
        }
    }

    physicsDebugRenderer(world, debugEnabled)
  }
}
