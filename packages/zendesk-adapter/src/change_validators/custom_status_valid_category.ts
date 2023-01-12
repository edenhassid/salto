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
import { ChangeValidator, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { CUSTOM_STATUS_TYPE_NAME, HOLD_CATEGORY, OPEN_CATEGORY, PENDING_CATEGORY, SOLVED_CATEGORY } from '../constants'

const VALID_CATEGORY = [PENDING_CATEGORY, SOLVED_CATEGORY, HOLD_CATEGORY, OPEN_CATEGORY]


export const customStatusCategoryValidator: ChangeValidator = async changes => changes
  .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
  .filter(isInstanceChange)
  .map(getChangeData)
  .filter(inst => !VALID_CATEGORY.includes(inst.value.status_category))
  .flatMap(instance => (
    [{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Invalid status category. Status Category - must be one of these: open, pending, hold, and solved',
      detailedMessage: `Invalid status category for ${instance.elemID.name}. Status Category - must be one of these: open, pending, hold, and solved`,
    }]
  ))
