import { HookContext } from '@feathersjs/feathers'

import { UserInterface } from '@xrengine/common/src/interfaces/User'

import { NotFoundException, UnauthenticatedException, UnauthorizedException } from '../util/exceptions/exception'
import { Application } from './../../declarations'

export default (currentType: string, scopeToVerify: string) => {
  return async (context: HookContext<Application>) => {
    console.log('verify-scope', context.params)
    if (context.params.isInternal) return context
    const loggedInUser = context.params.user as UserInterface
    if (!loggedInUser) throw new UnauthenticatedException('No logged in user')
    const scopes = await context.app.service('scope').Model.findAll({
      where: {
        userId: loggedInUser.id
      },
      raw: true,
      nest: true
    })
    if (!scopes) throw new NotFoundException('No scope available for the current user.')

    const currentScopes = scopes.reduce((result, sc) => {
      if (sc.type.split(':')[0] === currentType) result.push(sc.type.split(':')[1])
      return result
    }, [])
    if (!currentScopes.includes(scopeToVerify)) {
      if (scopeToVerify === 'admin') throw new UnauthorizedException('Must be admin to perform this action')
      else {
        console.log(
          'scope not found, and not admin',
          currentScopes,
          currentType,
          scopeToVerify,
          context.method,
          context.path,
          context
        )
        throw new UnauthorizedException(`Unauthorised ${scopeToVerify} action on ${currentType}`)
      }
    }
    return context
  }
}
