/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ChangeValidator, getChangeData, isModificationChange, InstanceElement, isInstanceChange,
  ModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_LIST, NETSUITE } from '../constants'

const { makeArray } = collections.array

const isCustomListChange = (change: ModificationChange<InstanceElement>): boolean =>
  getChangeData(change).refType.elemID.isEqual(new ElemID(NETSUITE, CUSTOM_LIST))

const hasItemRemoval = (change: ModificationChange<InstanceElement>): boolean => {
  const beforeCustomList = change.data.before
  const afterCustomList = change.data.after
  const afterItemsScriptIds = new Set(
    makeArray(afterCustomList.value.customvalues?.customvalue).map(item => item.scriptid)
  )
  const beforeItems = makeArray(beforeCustomList.value.customvalues?.customvalue)
  return beforeItems.some(beforeItem => !afterItemsScriptIds.has(beforeItem.scriptid))
}

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(isCustomListChange)
    .filter(hasItemRemoval)
    .map(getChangeData)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: `Removing customvalue from ${CUSTOM_LIST} is forbidden`,
      detailedMessage: `${elemID.name} has customvalues that were removed`,
    }))
)

export default changeValidator
