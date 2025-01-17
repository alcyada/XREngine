import { createState } from '@hookstate/core'
import { useState } from '@hookstate/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { CircleBufferGeometry, Mesh, MeshBasicMaterial } from 'three'

import { useEngineState } from '@xrengine/engine/src/ecs/classes/EngineState'
import { createTransitionState } from '@xrengine/engine/src/xrui/functions/createTransitionState'
import { createXRUI } from '@xrengine/engine/src/xrui/functions/createXRUI'
import { useXRUIState } from '@xrengine/engine/src/xrui/functions/useXRUIState'

import { useUserState } from '../../../user/services/UserService'
import styleString from './index.scss'

export function createAvatarDetailView(id: string) {
  const videoPreviewMesh = new Mesh(new CircleBufferGeometry(0.25, 32), new MeshBasicMaterial())
  return createXRUI(
    AvatarDetailView,
    createState({
      id,
      videoPreviewMesh
    })
  )
}

interface AvatarDetailState {
  id: string
}

const AvatarDetailView = () => {
  const { t } = useTranslation()
  const detailState = useXRUIState<AvatarDetailState>()
  const userState = useUserState()
  const user = userState.layerUsers.find((user) => user.id.value === detailState.id.value)
  const engineState = useEngineState()
  const usersTyping = useState(engineState.usersTyping[detailState.id.value]).value

  return (
    <>
      <link href="https://fonts.googleapis.com/css?family=Lato:400" rel="stylesheet" type="text/css" />
      <style>{styleString}</style>
      {user && (
        <div className="avatarName">
          {user.name.value}
          {usersTyping && <h6 className="typingIndicator">{t('common:typing')}</h6>}
        </div>
      )}
    </>
  )
}
