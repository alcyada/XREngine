import assert from 'assert'
import proxyquire from 'proxyquire'
import { Object3D } from 'three'

import {
  AudioComponent,
  AudioComponentType,
  SCENE_COMPONENT_AUDIO_DEFAULT_VALUES
} from '../../../audio/components/AudioComponent'
import { AudioType, AudioTypeType } from '../../../audio/constants/AudioConstants'
import { Entity } from '../../../ecs/classes/Entity'
import { addComponent, getComponent, hasComponent } from '../../../ecs/functions/ComponentFunctions'
import { createEntity } from '../../../ecs/functions/EntityFunctions'
import { createEngine } from '../../../initializeEngine'
import { Object3DComponent } from '../../components/Object3DComponent'
import { deserializeAudio } from './AudioFunctions'

const testURLs = {
  noContentType: { url: 'noContentType' },
  'test.mp3': { url: 'test.mp3', contentType: 'audio/mpeg', buffer: 123 },
  noBuffer: { url: 'noBuffer', contentType: 'audio/mpeg' }
}

class Audio extends Object3D {
  loop: boolean
  isPlaying: boolean
  buffer: any
  volume: number
  distanceModel: DistanceModelType
  rolloffFactor: number
  refDistance: number
  maxDistance: number
  panner = {}
  setLoop(loop: boolean) {
    this.loop = loop
  }
  setBuffer(buffer: any) {
    this.buffer = buffer
  }
  stop() {
    this.isPlaying = false
  }
  play() {
    this.isPlaying = true
  }
  setVolume(volume: number) {
    this.volume = volume
  }
  setDistanceModel(distanceModel: DistanceModelType) {
    this.distanceModel = distanceModel
  }
  setRolloffFactor(rolloffFactor: number) {
    this.rolloffFactor = rolloffFactor
  }
  setRefDistance(refDistance: number) {
    this.refDistance = refDistance
  }
  setMaxDistance(maxDistance: number) {
    this.maxDistance = maxDistance
  }
}

class PositionalAudio extends Audio {}

describe.skip('AudioFunctions', () => {
  let entity: Entity
  let audioFunctions = proxyquire('./AudioFunctions', {
    '../../../common/functions/isClient': { isClient: true },
    three: {
      Audio: Audio,
      PositionalAudio: PositionalAudio
    }
  })

  beforeEach(() => {
    createEngine()
    entity = createEntity()
  })

  const sceneComponentData = {
    audioSource: 'test.mp3',
    volume: Math.random(),
    audioType: AudioType.Positional as AudioTypeType,
    distanceModel: 'linear' as DistanceModelType,
    rolloffFactor: Math.random(),
    refDistance: Math.random(),
    maxDistance: Math.random(),
    coneInnerAngle: Math.random(),
    coneOuterAngle: Math.random(),
    coneOuterGain: Math.random()
  }

  describe('deserializeAudio()', () => {
    describe('Object 3D Tests', () => {
      it('add object 3d component if not present', () => {
        deserializeAudio(entity, sceneComponentData)
        assert(hasComponent(entity, Object3DComponent))
      })

      it('will not add object 3d component if already present', () => {
        const obj3d = new Object3D()

        addComponent(entity, Object3DComponent, { value: obj3d })
        deserializeAudio(entity, sceneComponentData)

        const obj3dComp = getComponent(entity, Object3DComponent)
        assert(obj3dComp && obj3dComp.value === obj3d)
      })
    })

    describe('Client vs Server', () => {
      it('will add audio component while running on client', () => {
        audioFunctions.deserializeAudio(entity, sceneComponentData)
        assert(hasComponent(entity, AudioComponent))
      })

      it('will not add audio component while running on server', () => {
        const _audioFunctions = proxyquire('./AudioFunctions', {
          '../../../common/functions/isClient': {
            isClient: false
          }
        })

        _audioFunctions.deserializeAudio(entity, sceneComponentData)
        assert(!hasComponent(entity, AudioComponent))
      })
    })

    it('sets loop and autoplay', () => {
      // addComponent(entity, MediaComponent, { autoplay: true, loop: true } as MediaComponentType)
      audioFunctions.deserializeAudio(entity, sceneComponentData)

      const obj3d = getComponent(entity, Object3DComponent).value
      assert(obj3d.userData.audioEl.autoplay === true, 'Autoplay is not being set')
      assert(obj3d.userData.audioEl.loop === true, 'Loop is not being set')
    })
  })

  describe('updateAudio()', () => {
    let audioComponent: AudioComponentType
    let obj3d: Object3D

    beforeEach(() => {
      audioFunctions.deserializeAudio(entity, sceneComponentData)
      audioComponent = getComponent(entity, AudioComponent) as AudioComponentType
      obj3d = getComponent(entity, Object3DComponent)?.value as Object3D
    })

    describe('Property tests for "audioType"', () => {
      it('should not update property', () => {
        audioFunctions.updateAudio(entity, {})

        assert(audioComponent.audioType === sceneComponentData.audioType)
        assert(obj3d.userData.audioEl instanceof PositionalAudio)
      })

      it('should update property', () => {
        audioComponent.audioType = AudioType.Stereo
        audioFunctions.updateAudio(entity, { audioType: AudioType.Stereo })

        assert(obj3d.userData.audioEl instanceof Audio)

        audioFunctions.updateAudio(entity, { audioType: AudioType.Positional })
        assert(obj3d.userData.audioEl.constructor === Audio, 'should not update property to passed value')
      })
    })

    // describe('Property tests for "audioSource"', () => {
    //   it('should not update property', () => {
    //     audioFunctions.updateAudio(entity, {})

    //     assert(audioComponent.audioSource === sceneComponentData.audioSource)
    //   })

    //   it('should add error component if some error occurs while fetching data', () => {
    //     audioComponent.audioSource = 'error'
    //     audioFunctions.updateAudio(entity, { audioSource: 'error' })
    //     assert(hasComponent(entity, ErrorComponent))
    //   })

    //   it('should add error component if content type of source can not be determined', () => {
    //     audioComponent.audioSource = 'noContentType'
    //     audioFunctions.updateAudio(entity, { audioSource: 'noContentType' })
    //     assert(hasComponent(entity, ErrorComponent))
    //   })

    //   it('should not update buffer', () => {
    //     audioComponent.audioSource = 'noBuffer'
    //     const num = Math.random()
    //     obj3d.userData.audioEl.buffer = num
    //     audioFunctions.updateAudio(entity, { audioSource: audioComponent.audioSource })

    //     assert.equal(obj3d.userData.audioEl.buffer, num)
    //   })

    //   it('should update property', () => {
    //     obj3d.userData.audioEl.isPlaying = true
    //     AssetLoader.Cache.set(
    //       AssetLoader.getAbsolutePath(audioComponent.audioSource),
    //       testURLs[audioComponent.audioSource].buffer
    //     )
    //     audioFunctions.updateAudio(entity, { audioSource: audioComponent.audioSource })

    //     assert.equal(obj3d.userData.audioEl.buffer, testURLs[audioComponent.audioSource].buffer)
    //     assert(!hasComponent(entity, ErrorComponent))
    //     assert(!obj3d.userData.audioEl.isPlaying)
    //   })
    // })

    describe('Property tests for "volume"', () => {
      it('should not update property', () => {
        audioFunctions.updateAudio(entity, {})

        assert(audioComponent.volume === sceneComponentData.volume)
        assert(obj3d.userData.audioEl.volume === sceneComponentData.volume)
      })

      it('should update property', () => {
        audioComponent.volume = Math.random()

        audioFunctions.updateAudio(entity, { volume: audioComponent.volume })
        assert(obj3d.userData.audioEl.volume === audioComponent.volume)

        audioFunctions.updateAudio(entity, { volume: Math.random() })
        assert(obj3d.userData.audioEl.volume === audioComponent.volume, 'should not update property to passed value')
      })
    })

    describe('Positional Audio Properties', () => {
      it('should not update positional properties for sterio type', () => {
        audioComponent.rolloffFactor = Math.random()
        audioComponent.audioType = AudioType.Stereo
        audioFunctions.updateAudio(entity, { rolloffFactor: audioComponent.rolloffFactor })

        assert(obj3d.userData.audioEl.rolloffFactor !== audioComponent.rolloffFactor)
      })

      describe('Property tests for "distanceModel"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.distanceModel === sceneComponentData.distanceModel)
          assert(obj3d.userData.audioEl.distanceModel === sceneComponentData.distanceModel)
        })

        it('should update property', () => {
          audioComponent.distanceModel = 'exponential'

          audioFunctions.updateAudio(entity, { distanceModel: audioComponent.distanceModel })
          assert(obj3d.userData.audioEl.distanceModel === audioComponent.distanceModel)

          audioFunctions.updateAudio(entity, { distanceModel: 'linear' })
          assert(
            obj3d.userData.audioEl.distanceModel === audioComponent.distanceModel,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "rolloffFactor"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.rolloffFactor === sceneComponentData.rolloffFactor)
          assert(obj3d.userData.audioEl.rolloffFactor === sceneComponentData.rolloffFactor)
        })

        it('should update property', () => {
          audioComponent.rolloffFactor = Math.random()

          audioFunctions.updateAudio(entity, { rolloffFactor: audioComponent.rolloffFactor })
          assert(obj3d.userData.audioEl.rolloffFactor === audioComponent.rolloffFactor)

          audioFunctions.updateAudio(entity, { rolloffFactor: Math.random() })
          assert(
            obj3d.userData.audioEl.rolloffFactor === audioComponent.rolloffFactor,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "refDistance"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.refDistance === sceneComponentData.refDistance)
          assert(obj3d.userData.audioEl.refDistance === sceneComponentData.refDistance)
        })

        it('should update property', () => {
          audioComponent.refDistance = Math.random()

          audioFunctions.updateAudio(entity, { refDistance: audioComponent.refDistance })
          assert(obj3d.userData.audioEl.refDistance === audioComponent.refDistance)

          audioFunctions.updateAudio(entity, { refDistance: Math.random() })
          assert(
            obj3d.userData.audioEl.refDistance === audioComponent.refDistance,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "maxDistance"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.maxDistance === sceneComponentData.maxDistance)
          assert(obj3d.userData.audioEl.maxDistance === sceneComponentData.maxDistance)
        })

        it('should update property', () => {
          audioComponent.maxDistance = Math.random()

          audioFunctions.updateAudio(entity, { maxDistance: audioComponent.maxDistance })
          assert(obj3d.userData.audioEl.maxDistance === audioComponent.maxDistance)

          audioFunctions.updateAudio(entity, { maxDistance: Math.random() })
          assert(
            obj3d.userData.audioEl.maxDistance === audioComponent.maxDistance,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "coneInnerAngle"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.coneInnerAngle === sceneComponentData.coneInnerAngle)
          assert(obj3d.userData.audioEl.panner.coneInnerAngle === sceneComponentData.coneInnerAngle)
        })

        it('should update property', () => {
          audioComponent.coneInnerAngle = Math.random()

          audioFunctions.updateAudio(entity, { coneInnerAngle: audioComponent.coneInnerAngle })
          assert(obj3d.userData.audioEl.panner.coneInnerAngle === audioComponent.coneInnerAngle)

          audioFunctions.updateAudio(entity, { coneInnerAngle: Math.random() })
          assert(
            obj3d.userData.audioEl.panner.coneInnerAngle === audioComponent.coneInnerAngle,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "coneOuterAngle"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.coneOuterAngle === sceneComponentData.coneOuterAngle)
          assert(obj3d.userData.audioEl.panner.coneOuterAngle === sceneComponentData.coneOuterAngle)
        })

        it('should update property', () => {
          audioComponent.coneOuterAngle = Math.random()

          audioFunctions.updateAudio(entity, { coneOuterAngle: audioComponent.coneOuterAngle })
          assert(obj3d.userData.audioEl.panner.coneOuterAngle === audioComponent.coneOuterAngle)

          audioFunctions.updateAudio(entity, { coneOuterAngle: Math.random() })
          assert(
            obj3d.userData.audioEl.panner.coneOuterAngle === audioComponent.coneOuterAngle,
            'should not update property to passed value'
          )
        })
      })

      describe('Property tests for "coneOuterGain"', () => {
        it('should not update property', () => {
          audioFunctions.updateAudio(entity, {})

          assert(audioComponent.coneOuterGain === sceneComponentData.coneOuterGain)
          assert(obj3d.userData.audioEl.panner.coneOuterGain === sceneComponentData.coneOuterGain)
        })

        it('should update property', () => {
          audioComponent.coneOuterGain = Math.random()

          audioFunctions.updateAudio(entity, { coneOuterGain: audioComponent.coneOuterGain })
          assert(obj3d.userData.audioEl.panner.coneOuterGain === audioComponent.coneOuterGain)

          audioFunctions.updateAudio(entity, { coneOuterGain: Math.random() })
          assert(
            obj3d.userData.audioEl.panner.coneOuterGain === audioComponent.coneOuterGain,
            'should not update property to passed value'
          )
        })
      })
    })
  })

  describe('serializeAudio()', () => {
    it('should properly serialize audio', () => {
      audioFunctions.deserializeAudio(entity, sceneComponentData)
      assert.deepEqual(audioFunctions.serializeAudio(entity), sceneComponentData)
    })

    it('should return undefine if there is no audio component', () => {
      assert(audioFunctions.serializeAudio(entity) === undefined)
    })
  })

  describe('toggleAudio()', () => {
    it('should properly toggle audio', () => {
      audioFunctions.deserializeAudio(entity, sceneComponentData)

      const audioEl = getComponent(entity, Object3DComponent)?.value.userData.audioEl as Audio
      let prevState = audioEl.isPlaying
      audioFunctions.toggleAudio(entity)

      assert(audioEl.isPlaying !== prevState)

      prevState = audioEl.isPlaying
      audioFunctions.toggleAudio(entity)

      assert(audioEl.isPlaying !== prevState)
    })

    it('should do nothing if no audio component is there', () => {
      const entity = createEntity()
      addComponent(entity, Object3DComponent, { value: new Object3D() })
      audioFunctions.toggleAudio(entity)
      assert(true)
    })
  })

  describe('parseAudioProperties()', () => {
    it('should use default component values', () => {
      const componentData = audioFunctions.parseAudioProperties({})
      assert(componentData.volume === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.volume)
      assert(componentData.audioType === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.audioType)
      assert(componentData.distanceModel === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.distanceModel)
      assert(componentData.rolloffFactor === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.rolloffFactor)
      assert(componentData.refDistance === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.refDistance)
      assert(componentData.maxDistance === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.maxDistance)
      assert(componentData.coneInnerAngle === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.coneInnerAngle)
      assert(componentData.coneOuterAngle === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.coneOuterAngle)
      assert(componentData.coneOuterGain === SCENE_COMPONENT_AUDIO_DEFAULT_VALUES.coneOuterGain)
    })

    it('should use passed values', () => {
      const props = {
        audioSource: 'Test',
        volume: Math.random(),
        audioType: AudioType.Stereo as AudioTypeType,
        distanceModel: 'exponential' as DistanceModelType,
        rolloffFactor: Math.random(),
        refDistance: Math.random(),
        maxDistance: Math.random(),
        coneInnerAngle: Math.random(),
        coneOuterAngle: Math.random(),
        coneOuterGain: Math.random()
      }
      const componentData = audioFunctions.parseAudioProperties(props)

      assert(componentData.audioSource === props.audioSource)
      assert(componentData.volume === props.volume)
      assert(componentData.audioType === props.audioType)
      assert(componentData.distanceModel === props.distanceModel)
      assert(componentData.rolloffFactor === props.rolloffFactor)
      assert(componentData.refDistance === props.refDistance)
      assert(componentData.maxDistance === props.maxDistance)
      assert(componentData.coneInnerAngle === props.coneInnerAngle)
      assert(componentData.coneOuterAngle === props.coneOuterAngle)
      assert(componentData.coneOuterGain === props.coneOuterGain)
    })
  })

  describe('prepareAudioForGLTFExport()', () => {
    let audio: Object3D = new Object3D()
    let audioEl: Object3D = new Object3D()
    let textureMesh: Object3D = new Object3D()

    describe('Audio Element', () => {
      beforeEach(() => {
        audio = new Object3D()
        audioEl = new Object3D()
        audio.userData.audioEl = audioEl
        audio.add(audioEl)
      })

      it('should remove audio element', () => {
        audioFunctions.prepareAudioForGLTFExport(audio)
        assert(!audio.children.includes(audioEl))
        assert(!audio.userData.audioEl)
      })
    })

    describe('Audio Texture mesh', () => {
      beforeEach(() => {
        audio = new Object3D()
        textureMesh = new Object3D()
        audio.userData.textureMesh = textureMesh
        audio.add(textureMesh)
      })

      it('should remove texture mesh', () => {
        audioFunctions.prepareAudioForGLTFExport(audio)
        assert(!audio.children.includes(audio.userData.textureMesh))
        assert(!audio.userData.textureMesh)
      })
    })
  })
})
