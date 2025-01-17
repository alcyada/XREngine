import { detect, detectOS } from 'detect-browser'
import _ from 'lodash'

import { BotUserAgent } from '@xrengine/common/src/constants/BotUserAgent'
import { addActionReceptor, dispatchAction, getState } from '@xrengine/hyperflux'

import { getGLTFLoader } from './assets/classes/AssetLoader'
import { initializeKTX2Loader } from './assets/functions/createGLTFLoader'
import { isClient } from './common/functions/isClient'
import { Timer } from './common/functions/Timer'
import { Engine } from './ecs/classes/Engine'
import { EngineActions, EngineEventReceptor, EngineState } from './ecs/classes/EngineState'
import { createWorld, destroyWorld } from './ecs/classes/World'
import FixedPipelineSystem from './ecs/functions/FixedPipelineSystem'
import { initSystems, initSystemSync, SystemModuleType } from './ecs/functions/SystemFunctions'
import { SystemUpdateType } from './ecs/functions/SystemUpdateType'
import { matchActionOnce } from './networking/functions/matchActionOnce'
import IncomingActionSystem from './networking/systems/IncomingActionSystem'
import OutgoingActionSystem from './networking/systems/OutgoingActionSystem'
import { EngineRenderer } from './renderer/WebGLRendererSystem'
import { ObjectLayers } from './scene/constants/ObjectLayers'
import { FontManager } from './xrui/classes/FontManager'

/**
 * Creates a new instance of the engine and engine renderer. This initializes all properties and state for the engine,
 * adds action receptors and creates a new world.
 * @returns {Engine}
 */
export const createEngine = () => {
  if (Engine.instance?.currentWorld) {
    destroyWorld(Engine.instance.currentWorld)
  }
  Engine.instance = new Engine()
  createWorld()
  EngineRenderer.instance = new EngineRenderer()
  addActionReceptor(EngineEventReceptor)
  Engine.instance.engineTimer = Timer(executeWorlds, Engine.instance.tickRate)
}

export const setupEngineActionSystems = () => {
  const world = Engine.instance.currentWorld
  initSystemSync(world, {
    type: SystemUpdateType.UPDATE,
    systemFunction: FixedPipelineSystem
  })
  initSystemSync(world, {
    type: SystemUpdateType.FIXED_EARLY,
    systemFunction: IncomingActionSystem
  })
  initSystemSync(world, {
    type: SystemUpdateType.FIXED_LATE,
    systemFunction: OutgoingActionSystem
  })
}

/**
 * initializeBrowser
 *
 * initializes everything for the browser context
 */
export const initializeBrowser = () => {
  const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)()
  audioContext.resume()
  Engine.instance.audioContext = audioContext
  Engine.instance.publicPath = location.origin
  Engine.instance.cameraGainNode = audioContext.createGain()
  Engine.instance.cameraGainNode.connect(audioContext.destination)
  const world = Engine.instance.currentWorld
  world.camera.layers.disableAll()
  world.camera.layers.enable(ObjectLayers.Scene)
  world.camera.layers.enable(ObjectLayers.Avatar)
  world.camera.layers.enable(ObjectLayers.UI)

  Engine.instance.isBot = navigator.userAgent === BotUserAgent

  const browser = detect()
  const os = detectOS(navigator.userAgent)

  // Add iOS and safari flag to window object -- To use it for creating an iOS compatible WebGLRenderer for example
  ;(window as any).iOS =
    os === 'iOS' ||
    /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ;(window as any).safariWebBrowser = browser?.name === 'safari'

  Engine.instance.isHMD = /Oculus/i.test(navigator.userAgent) // TODO: more HMDs;

  setupInitialClickListener()

  // maybe needs to be awaited?
  FontManager.instance.getDefaultFont()

  matchActionOnce(EngineActions.connect.matches, (action: any) => {
    Engine.instance.userId = action.id
  })
  EngineRenderer.instance.initialize()
  Engine.instance.engineTimer.start()
}

const setupInitialClickListener = () => {
  const initialClickListener = () => {
    dispatchAction(EngineActions.setUserHasInteracted({}))
    window.removeEventListener('click', initialClickListener)
    window.removeEventListener('touchend', initialClickListener)
  }
  window.addEventListener('click', initialClickListener)
  window.addEventListener('touchend', initialClickListener)
}

/**
 * initializeNode
 *
 * initializes everything for the node context
 */
export const initializeNode = () => {
  Engine.instance.engineTimer.start()
}

const executeWorlds = (elapsedTime) => {
  const engineState = getState(EngineState)
  engineState.frameTime.set(elapsedTime)
  for (const world of Engine.instance.worlds) {
    world.execute(elapsedTime)
  }
}

export const initializeMediaServerSystems = async () => {
  dispatchAction(EngineActions.initializeEngine({ initialised: true }))
}

export const initializeCoreSystems = async () => {
  const systemsToLoad: SystemModuleType<any>[] = []
  systemsToLoad.push(
    {
      type: SystemUpdateType.UPDATE_LATE,
      systemModulePromise: import('./transform/systems/TransformSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/SceneObjectSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/SceneLoadingSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/SceneObjectUpdateSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/LightSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/AssetSystem')
    }
  )

  if (isClient) {
    systemsToLoad.push(
      {
        type: SystemUpdateType.UPDATE,
        systemModulePromise: import('./camera/systems/CameraSystem')
      },
      {
        type: SystemUpdateType.UPDATE_EARLY,
        systemModulePromise: import('./xr/XRSystem')
      },
      {
        type: SystemUpdateType.UPDATE_EARLY,
        systemModulePromise: import('./input/systems/ClientInputSystem')
      },
      {
        type: SystemUpdateType.UPDATE,
        systemModulePromise: import('./xrui/systems/XRUISystem')
      },
      {
        type: SystemUpdateType.FIXED_LATE,
        systemModulePromise: import('./scene/systems/SceneObjectDynamicLoadSystem')
      },
      {
        type: SystemUpdateType.FIXED_LATE,
        systemModulePromise: import('./scene/systems/MaterialOverrideSystem')
      },
      {
        type: SystemUpdateType.FIXED_LATE,
        systemModulePromise: import('./scene/systems/InstancingSystem')
      },
      {
        type: SystemUpdateType.RENDER,
        systemModulePromise: import('./renderer/WebGLRendererSystem')
      }
    )
  }

  const world = Engine.instance.currentWorld
  await initSystems(world, systemsToLoad)

  // load injected systems which may rely on core systems
  await initSystems(world, Engine.instance.injectedSystems)

  dispatchAction(EngineActions.initializeEngine({ initialised: true }))
}

/**
 * everything needed for rendering 3d scenes
 */

export const initializeSceneSystems = async () => {
  const world = Engine.instance.currentWorld

  const systemsToLoad: SystemModuleType<any>[] = []

  systemsToLoad.push(
    {
      type: SystemUpdateType.FIXED,
      systemModulePromise: import('./avatar/AvatarSpawnSystem')
    },
    {
      type: SystemUpdateType.FIXED,
      systemModulePromise: import('./avatar/AvatarSystem')
    },
    /** @todo fix equippable implementation */
    // {
    //   type: SystemUpdateType.FIXED_LATE,
    //   systemModulePromise: import('./interaction/systems/EquippableSystem')
    // },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./physics/systems/PhysicsSystem')
    },
    {
      type: SystemUpdateType.FIXED_LATE,
      systemModulePromise: import('./scene/systems/TriggerSystem')
    }
  )
  if (isClient) {
    systemsToLoad.push(
      {
        type: SystemUpdateType.UPDATE,
        systemModulePromise: import('./navigation/systems/AutopilotSystem')
      },
      {
        type: SystemUpdateType.UPDATE,
        systemModulePromise: import('./scene/systems/HyperspacePortalSystem')
      },
      {
        type: SystemUpdateType.FIXED,
        systemModulePromise: import('./avatar/AvatarTeleportSystem')
      },
      {
        type: SystemUpdateType.FIXED,
        systemModulePromise: import('./avatar/AvatarControllerSystem')
      },
      {
        type: SystemUpdateType.UPDATE_LATE,
        systemModulePromise: import('./interaction/systems/InteractiveSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./interaction/systems/MountPointSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./audio/systems/AudioSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./audio/systems/PositionalAudioSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./interaction/systems/MediaControlSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./avatar/AvatarLoadingSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./avatar/AnimationSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./scene/systems/RendererUpdateSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./scene/systems/ParticleSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./debug/systems/DebugHelpersSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./renderer/HighlightSystem')
      },
      {
        type: SystemUpdateType.PRE_RENDER,
        systemModulePromise: import('./scene/systems/EntityNodeEventSystem')
      }
    )

    // todo: figure out the race condition that is stopping us from moving this to SceneObjectSystem
    initializeKTX2Loader(getGLTFLoader())
  }

  await initSystems(world, systemsToLoad)
}

export const initializeRealtimeSystems = async (media = true, pose = true) => {
  const systemsToLoad: SystemModuleType<any>[] = []

  systemsToLoad.push({
    type: SystemUpdateType.FIXED_EARLY,
    systemModulePromise: import('./networking/systems/WorldNetworkActionSystem')
  })

  if (media) {
    systemsToLoad.push({
      type: SystemUpdateType.UPDATE,
      systemModulePromise: import('./networking/systems/MediaStreamSystem')
    })
  }

  if (pose) {
    systemsToLoad.push(
      {
        type: SystemUpdateType.FIXED_EARLY,
        systemModulePromise: import('./networking/systems/IncomingNetworkSystem')
      },
      {
        type: SystemUpdateType.FIXED_LATE,
        systemModulePromise: import('./networking/systems/OutgoingNetworkSystem')
      }
    )
  }

  await initSystems(Engine.instance.currentWorld, systemsToLoad)
}
