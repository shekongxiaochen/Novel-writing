import type { Character, Faction, Item } from '../../types'

export type EntityToken = {
  text: string
  /** 在章节正文中的绝对偏移区间（[start, end)） */
  range?: {
    start: number
    end: number
  }
  character: Character | null
  faction: Faction | null
  item: Item | null
  foreshadow:
    | null
    | {
        id: string
        title: string
        status: 'open' | 'fulfilled'
        description: string
        /** 当前标记对应的正文片段（植入处为 plantText；照应处为 fulfillText） */
        text?: string
        /** 植入处 / 填坑处（对应伏笔选区） */
        segment: 'plant' | 'fulfill'
        /** 当 segment=fulfill 时，对应具体照应记录 id */
        fulfillmentId?: string
        /** 用于强制触发同目标重复跳转后的闪烁/重新定位 */
        jumpToken?: string
      }
  /**
   * 角色在当前章节所属的修改时间区间信息，用于正文叠加层底色标注。
   * null 表示：角色尚未被修改过（从创建到第一次修改之间），不显示底色。
   */
  characterStateZone?: {
    /** 底色标注 label，例如"年龄：19"（该时间区间内角色的属性值） */
    label: string
    /** 对应的字段名，例如"age" */
    fieldKey: string
    /** 区间索引（从 1 开始），用于循环选色 */
    zoneIndex: number
  } | null
  /**
   * 该名字在正文中的区间是否与「在本章保存角色档案」时记录的选区锚点相交
   *（用于与正文其他出现处区分颜色）。
   */
  characterAnchorEditSite?: boolean
  /**
   * 势力在当前章节所属的修改时间区间（规则同角色 characterStateZone）。
   */
  factionStateZone?: {
    label: string
    fieldKey: string
    zoneIndex: number
  } | null
  /**
   * 与「在本章保存势力档案」时记录的选区锚点相交（用于叠加层与角色锚点区分样式）。
   */
  factionAnchorEditSite?: boolean
}
