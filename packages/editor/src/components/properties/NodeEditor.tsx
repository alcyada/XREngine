import React from 'react'

import PropertyGroup from './PropertyGroup'
import { EditorPropType } from './Util'

//declaring NodeEditorProps
type NodeEditorProps = EditorPropType & {
  description?: string
  name?: string
}

/**
 * NodeEditor component used to render editor view.
 *
 * @type {class component}
 */
export const NodeEditor: React.FC<NodeEditorProps> = ({ description, children, name }) => {
  return (
    <PropertyGroup name={name} description={description}>
      {children}
    </PropertyGroup>
  )
}

export default NodeEditor
