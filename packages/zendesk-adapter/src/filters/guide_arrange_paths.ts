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
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  ZENDESK, GUIDE, BRAND_TYPE_NAME,
} from '../constants'
import {
  ARTICLES_ORDER,
  CATEGORIES_ORDER,
  // GUIDE_ORDER_TYPES,
  SECTIONS_ORDER,
} from './guide_order/guide_orders_utils'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

export const UNSORTED = 'unsorted'
export const GUIDE_PATH = [ZENDESK, RECORDS_PATH, GUIDE]
const FIRST_LEVEL_TYPES = [USER_SEGMENT_TYPE_NAME, PERMISSION_GROUP_TYPE_NAME]
const BRAND_SECOND_LEVEL = [
  CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  CATEGORIES_ORDER,
]
const PARENTS = [CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ARTICLE_TYPE_NAME]
const TRANSLATIONS = [
  CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME]

const OTHER_TYPES = [...TRANSLATIONS, SECTIONS_ORDER, ARTICLES_ORDER]
export const GUIDE_ELEMENT_DIRECTORY: Record<string, string> = {
  [ARTICLE_TRANSLATION_TYPE_NAME]: 'translations',
  [ARTICLE_TYPE_NAME]: 'articles',
  [CATEGORY_TYPE_NAME]: 'categories',
  [SECTION_TYPE_NAME]: 'sections',
  [SECTION_TRANSLATION_TYPE_NAME]: 'translations',
  [CATEGORY_TRANSLATION_TYPE_NAME]: 'translations',
  [GUIDE_SETTINGS_TYPE_NAME]: 'settings',
  [USER_SEGMENT_TYPE_NAME]: 'user_segments',
  [PERMISSION_GROUP_TYPE_NAME]: 'permission_groups',
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: 'language_settings',
  [CATEGORIES_ORDER]: 'categories_order',
  [SECTIONS_ORDER]: 'sections_order',
  [ARTICLES_ORDER]: 'articles_order',
}

/**
 * calculates a path which is not related to a specific brand
 */
const pathForGlobalTypes = (instance: InstanceElement): readonly string[] | undefined =>
  [
    ...GUIDE_PATH,
    GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
    pathNaclCase(instance.elemID.name),
  ]


/**
 * calculates a path which is related to a specific brand and does not have a parent
 */
const pathForBrandSpecificRootElements = (instance: InstanceElement, brandName: string | undefined)
  : readonly string[] => {
  if (brandName === undefined) {
    log.error('brandName was not found for instance %s.', instance.elemID.getFullName())
    return [
      ...GUIDE_PATH,
      UNSORTED,
      GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
      pathNaclCase(instance.elemID.name),
    ]
  }
  const newPath = [
    ...GUIDE_PATH,
    'brands',
    brandName,
    GUIDE_ELEMENT_DIRECTORY[instance.elemID.typeName],
    pathNaclCase(instance.elemID.name),
  ]
  if (instance.elemID.typeName === CATEGORY_TYPE_NAME) { // each category has a folder of its own
    newPath.push(pathNaclCase(instance.elemID.name))
  }
  return newPath
}

/**
 * calculates a path which is related to a specific brand and has a parent.
 */
const pathForOtherLevels = (params :{
  instance: InstanceElement
  needTypeDirectory: boolean
  needOwnFolder: boolean
  parent: InstanceElement | undefined
}): readonly string[] | undefined => {
  const parentPath = params.parent?.path
  if (params.parent === undefined || parentPath === undefined) {
    return [
      ...GUIDE_PATH,
      UNSORTED,
      GUIDE_ELEMENT_DIRECTORY[params.instance.elemID.typeName],
      pathNaclCase(params.instance.elemID.name),
    ]
  }
  const newPath = parentPath.slice(0, parentPath.length - 1)
  if (params.needTypeDirectory) {
    newPath.push(GUIDE_ELEMENT_DIRECTORY[params.instance.elemID.typeName])
  }
  if (params.needOwnFolder) {
    newPath.push(pathNaclCase(params.instance.elemID.name))
  }
  // if (GUIDE_ORDER_TYPES.includes(params.instance.elemID.typeName)) {
  //   newPath.push(pathNaclCase(params.parent.elemID.name))
  // } else {
  //   newPath.push(pathNaclCase(params.instance.elemID.name))
  // }
  newPath.push(pathNaclCase(params.instance.elemID.name))
  return newPath
}

const getId = (instance: InstanceElement): number => instance.value.id


const getFullName = (instance: InstanceElement): string =>
  instance.elemID.getFullName()

/**
 * This filter arranges the paths for guide elements.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const guideInstances = elements
      .filter(isInstanceElement)
      .filter(inst => Object.keys(GUIDE_ELEMENT_DIRECTORY).includes(inst.elemID.typeName))
    const guideGrouped = _.groupBy(guideInstances, inst => inst.elemID.typeName)

    const parents = guideInstances
      .filter(instance => PARENTS.includes(instance.elemID.typeName))
      .filter(parent => parent.value.id !== undefined)
    const parentsById = _.keyBy(parents, getId)
    const nameByIdParents = _.mapValues(_.keyBy(parents, getFullName), 'value.id')

    const brands = elements
      .filter(elem => elem.elemID.typeName === BRAND_TYPE_NAME)
      .filter(isInstanceElement)
      .filter(brand => brand.value.name !== undefined)
    const fullNameByNameBrand = _.mapValues(_.keyBy(brands, getFullName), 'value.name')

    // user_segments and permission_groups
    FIRST_LEVEL_TYPES
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        instance.path = pathForGlobalTypes(instance)
      })

    // category, settings, language_settings, category_order
    BRAND_SECOND_LEVEL
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        const brandElemId = instance.value.brand?.elemID.getFullName()
        instance.path = pathForBrandSpecificRootElements(instance, fullNameByNameBrand[brandElemId])
      })

    // sections under category
    const [categoryParent, sectionParent] = _.partition(
      guideGrouped[SECTION_TYPE_NAME] ?? [],
      inst => inst.value.direct_parent_type === CATEGORY_TYPE_NAME
    )
    categoryParent
      .forEach(instance => {
        const nameLookup = instance.value.direct_parent_id?.elemID.getFullName()
        const parent = nameLookup ? parentsById[nameByIdParents[nameLookup]] : undefined
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: true,
          parent,
        })
      })

    // sections under section
    sectionParent
      .forEach(instance => {
        const nameLookup = instance.value.direct_parent_id?.elemID.getFullName()
        const parent = nameLookup ? parentsById[nameByIdParents[nameLookup]] : undefined
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: false,
          needOwnFolder: true,
          parent,
        })
      })

    // articles
    const articles = guideGrouped[ARTICLE_TYPE_NAME] ?? []
    articles
      .forEach(instance => {
        const parentId = nameByIdParents[instance.value.section_id?.elemID.getFullName()]
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: true,
          parent: parentsById[parentId],
        })
      })

    // others (translations, article attachments, order)
    OTHER_TYPES
      .flatMap(type => guideGrouped[type])
      .filter(instance => instance !== undefined)
      .forEach(instance => {
        const parentId = getParent(instance).value.id
        instance.path = pathForOtherLevels({
          instance,
          needTypeDirectory: true,
          needOwnFolder: false,
          parent: parentsById[parentId],
        })
      })
  },
})

export default filterCreator
