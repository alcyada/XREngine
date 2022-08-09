import { createState, useHookstate } from '@hookstate/core'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { SendInvite } from '@xrengine/common/src/interfaces/Invite'
import { UserId } from '@xrengine/common/src/interfaces/UserId'
import { useEngineState } from '@xrengine/engine/src/ecs/classes/EngineState'
import { WorldState } from '@xrengine/engine/src/networking/interfaces/WorldState'
import { createXRUI } from '@xrengine/engine/src/xrui/functions/createXRUI'
import { useXRUIState } from '@xrengine/engine/src/xrui/functions/useXRUIState'
import { getState } from '@xrengine/hyperflux'

import { InviteService } from '../../../social/services/InviteService'
import { PartyService, usePartyState } from '../../../social/services/PartyService'
import { getAvatarURLForUser } from '../../../user/components/UserMenu/util'
import { useAuthState } from '../../../user/services/AuthService'
import { UserService, useUserState } from '../../../user/services/UserService'
import XRTextButton from '../../components/XRTextButton'
import styleString from './index.scss'

export function createAvatarContextMenuView() {
  return createXRUI(
    AvatarContextMenu,
    createState({
      id: '' as UserId
    })
  )
}

interface UserMenuState {
  id: UserId
}

const AvatarContextMenu = () => {
  const detailState = useXRUIState<UserMenuState>()

  const engineState = useEngineState()
  const userState = useUserState()
  const partyState = usePartyState()

  const authState = useAuthState()
  const user = userState.layerUsers.find((user) => user.id.value === detailState.id.value)
  const { t } = useTranslation()

  const userAvatarDetails = useHookstate(getState(WorldState).userAvatarDetails)
  const partyOwner = partyState.party?.partyUsers?.value
    ? partyState.party.partyUsers.value.find((partyUser) => partyUser.isOwner)
    : null

  // TODO: move these to widget register
  PartyService.useAPIListeners()

  const blockUser = () => {
    if (authState.user?.id?.value !== null && user) {
      const selfId = authState.user.id?.value ?? ''
      const blockUserId = user.id?.value ?? ''
      UserService.blockUser(selfId, blockUserId)
    }
  }

  const addAsFriend = () => {
    if (authState.user?.id?.value !== null && user) {
      const selfId = authState.user.id?.value ?? ''
      const blockUserId = user.id?.value ?? ''
      UserService.requestFriend(selfId, blockUserId)
    }
  }

  const inviteToParty = () => {
    if (authState.user?.partyId?.value && user?.id?.value) {
      const partyId = authState.user?.partyId?.value ?? ''
      const userId = user.id?.value
      const sendData = {
        inviteType: 'party',
        inviteeId: userId,
        targetObjectId: partyId,
        token: null
      } as SendInvite
      InviteService.sendInvite(sendData)
    }
  }

  const handleMute = () => {
    console.log('Mute pressed')
  }

  useEffect(() => {
    if (engineState.avatarTappedId.value !== authState.user.id.value)
      detailState.id.set(engineState.avatarTappedId.value)
  }, [engineState.avatarTappedId.value])

  return (
    <>
      <style>{styleString}</style>
      {user?.id.value && (
        <div className="rootContainer">
          <img
            className="ownerImage"
            src={getAvatarURLForUser(userAvatarDetails, user?.id?.value)}
            alt=""
            crossOrigin="anonymous"
          />
          <div className="buttonContainer">
            <section className="buttonSection">
              {partyState?.party?.id?.value != null &&
                partyOwner?.userId != null &&
                partyOwner.userId === authState.user?.id?.value &&
                user.partyId.value !== partyState.party?.id?.value && (
                  <XRTextButton onClick={inviteToParty}>{t('user:personMenu.inviteToParty')}</XRTextButton>
                )}
              <XRTextButton onClick={addAsFriend}>{t('user:personMenu.addAsFriend')}</XRTextButton>
              <XRTextButton onClick={handleMute}>{t('user:personMenu.mute')}</XRTextButton>
              <XRTextButton onClick={blockUser}>{t('user:personMenu.block')}</XRTextButton>
            </section>
          </div>
        </div>
      )}
    </>
  )
}