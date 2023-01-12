/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { CUSTOM_STATUS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)


const getName = (inst: InstanceElement): string => inst.elemID.name
const getAgentLabel = (inst: InstanceElement): string => inst.value.raw_agent_label

export const customStatusUniqueAgentLabelValidator: ChangeValidator = async (
  changes, elementSource
) => {
  if (elementSource === undefined) {
    log.error('Failed to run customStatusUniqueAgentLabelValidator because no element source was provided')
    return []
  }

  const allStatuses = await awu(await elementSource.getAll())
    .filter(elem => elem.elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isInstanceElement)
    .toArray()

  const statusByName = _.keyBy(allStatuses, getName)

  const agentLabelsByName = _.mapValues(statusByName, getAgentLabel)


  const isAgentLabelTaken = (inst: InstanceElement): boolean => !_.isEmpty(Object.keys(agentLabelsByName)
    .filter(key => key !== inst.elemID.name && agentLabelsByName[key] === inst.value.raw_agent_label))

  return changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isAgentLabelTaken)
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Invalid agent label. The label is already used by another status',
        detailedMessage: `Invalid agent label for ${instance.elemID.name}. The label is already used by another status`,
      }]
    ))
}
