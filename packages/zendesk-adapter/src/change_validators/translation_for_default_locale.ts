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
  ChangeValidator,
  getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { isTranslation, TranslationType } from '../filters/help_center_section'

const PARENTS_TYPE_NAMES = ['section']

type ParentType = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    source_locale: ReferenceExpression
    translations: ReferenceExpression[]
  }
}

const PARENT_SCHEMA = Joi.object({
  source_locale: Joi.object().required(),
  translations: Joi.array().required(),
}).unknown(true).required()

const isParent = createSchemeGuardForInstance<ParentType>(
  PARENT_SCHEMA, 'Received an invalid value for section/category'
)

/**
 * This function checks if there is no translation for the source_locale
 */
const noTranslationForDefaultLocale = (instance: InstanceElement): boolean => {
  if (!isParent(instance)) {
    return false
  }
  const sourceLocale = instance.value.source_locale.value.value.id
  const translation = instance.value.translations
    .map(translationReference => translationReference.value.value)
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale === sourceLocale)
  return (translation === undefined) // no translation for the source_locale
}

export const translationForDefaultLocaleValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => PARENTS_TYPE_NAMES.includes(instance.elemID.typeName))
    .filter(noTranslationForDefaultLocale)

  return relevantInstances
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Error',
      message: `Instance ${instance.elemID.getFullName()} does not have a translation for the source locale`,
      detailedMessage: `Instance ${instance.elemID.getFullName()} does not have a 
      translation for the source local ${instance.value.source_locale.value.value.id}`,
    }])
}
