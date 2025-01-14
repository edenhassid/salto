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
import { values, collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { isCustomType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE } from '../constants'
import { isInstanceContainsStringValue } from './utils'

const { awu } = collections.asynciterable
const { isDefined } = values

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(async change => {
      const instance = getChangeData(change)
      if (!isCustomType(instance.refType)) {
        return undefined
      }
      if (!isInstanceContainsStringValue(instance, ACCOUNT_SPECIFIC_VALUE)) {
        return undefined
      }
      return {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Element contains fields with account specific values. These fields will be skipped from the deployment.',
        detailedMessage: 'Fields with account specific values (ACCOUNT_SPECIFIC_VALUE) will be skipped from the deployment. After deploying this element, please make sure these fields are mapped correctly in NetSuite.',
      } as ChangeError
    })
    .filter(isDefined)
    .toArray()
)

export default changeValidator
