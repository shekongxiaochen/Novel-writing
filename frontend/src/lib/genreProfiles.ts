export type GenreProfile = {
  keywords: string[]
  label: string
  structureHints: string[]
  characterHints: string[]
  clicheWarnings: string[]
  tensionShape: 'rising' | 'wave' | 'spiral' | 'slow-burn'
}

const GENRE_PROFILES: GenreProfile[] = [
  {
    keywords: ['玄幻', '仙侠', '修仙', '修真', '洪荒'],
    label: '玄幻/仙侠',
    structureHints: [
      '叙事通常分"凡界→修炼→飞升"三段大跨度，每段自成体系',
      '境界突破节点应构成明确的节拍，不可无代价升级',
      '世界观规则（灵气、天劫、因果）必须在前期建立并在后期产生约束',
    ],
    characterHints: [
      '主角需有"为何修仙"的深层动机（不只是变强），且该动机应与结局呼应',
      '师徒/同门/道侣关系是核心情感线来源',
    ],
    clicheWarnings: [
      '避免"废柴觉醒→一路碾压"的无摩擦升级',
      '避免反派全是跳梁小丑、缺乏合理动机',
    ],
    tensionShape: 'wave',
  },
  {
    keywords: ['武侠', '江湖', '武林'],
    label: '武侠',
    structureHints: [
      '叙事常以"入江湖→卷入纷争→退出/超越江湖"为骨架',
      '武功体系需有内在逻辑（师承、内力、招式），不可凭空获得',
      '江湖规矩/门派利益是冲突的底层驱动力',
    ],
    characterHints: [
      '主角常面临"侠义 vs 个人幸福"的两难',
      '需要一个亦师亦友或亦敌亦友的关系推动成长',
    ],
    clicheWarnings: [
      '避免"比武大会→夺宝→再比武大会"的循环套路',
      '避免女性角色沦为奖品或花瓶',
    ],
    tensionShape: 'wave',
  },
  {
    keywords: ['都市', '现代', '现实', '职场', '商战'],
    label: '都市/现实',
    structureHints: [
      '冲突应来自人物的社会关系、利益博弈、价值观碰撞',
      '场景需有现实质感（行业细节、城市空间、生活节奏）',
      '节奏偏快，每章需推进至少一条信息或关系变化',
    ],
    characterHints: [
      '主角的欲望应与现实约束形成张力（金钱/地位/情感/道德）',
      '配角需有独立的利益诉求，不可只是主角的工具',
    ],
    clicheWarnings: [
      '避免"扮猪吃老虎"式无脑爽文结构',
      '避免所有冲突靠巧合或误会推动',
    ],
    tensionShape: 'rising',
  },
  {
    keywords: ['言情', '爱情', '甜宠', '虐恋', '恋爱'],
    label: '言情',
    structureHints: [
      '感情线是主线，情节应围绕"相遇→阻碍→突破→结局"展开',
      '每章需推进感情关系（靠近或疏远），不可原地踏步',
      '外部事件应作用于感情关系，而非感情线游离于主线之外',
    ],
    characterHints: [
      '双主角都需要独立的成长弧线，不可一方沦为另一方的附属',
      '核心阻碍应来自人物内在（恐惧/创伤/价值观差异），而非纯外部阻挠',
    ],
    clicheWarnings: [
      '避免"霸道总裁爱上我"的权力不对等浪漫化',
      '避免误会一句话就能解开但拖了二十章',
    ],
    tensionShape: 'wave',
  },
  {
    keywords: ['悬疑', '推理', '惊悚', '恐怖', '探案'],
    label: '悬疑/推理',
    structureHints: [
      '核心谜题必须在第一章建立，所有场景都应推进解谜或误导',
      '线索需按"伏笔→误导→揭示"的节奏分布，不可前期堆砌后期空洞',
      '真相揭示需有逻辑自洽性，所有伏笔必须回收',
    ],
    characterHints: [
      '侦探/主角需有独特的推理方式或认知盲区',
      '每个嫌疑人都需有动机和不在场证明的漏洞',
    ],
    clicheWarnings: [
      '避免"凶手是双胞胎/精神病/做梦"等偷懒解答',
      '避免线索只在需要时凭空出现',
    ],
    tensionShape: 'spiral',
  },
  {
    keywords: ['历史', '古代', '架空历史', '宫廷', '权谋'],
    label: '历史/权谋',
    structureHints: [
      '权力博弈是核心驱动力，每个角色都应有政治立场',
      '历史事件/制度应构成约束条件，不可随意篡改逻辑',
      '叙事可采用多视角，展现权力场中不同位置的博弈',
    ],
    characterHints: [
      '主角需在"理想 vs 现实"中做出艰难抉择',
      '对手应是制度或立场的对立面，而非单纯的恶人',
    ],
    clicheWarnings: [
      '避免主角靠现代知识碾压古人的穿越爽文套路',
      '避免宫廷斗争简化为"争宠"单一维度',
    ],
    tensionShape: 'slow-burn',
  },
  {
    keywords: ['科幻', '末日', '未来', '星际', '赛博朋克', '太空'],
    label: '科幻',
    structureHints: [
      '世界观设定需有科学逻辑自洽性（即使是软科幻）',
      '技术发展应改变社会结构和人际关系，而非只是背景板',
      '核心冲突常来自"技术进步 vs 人性困境"的张力',
    ],
    characterHints: [
      '主角需面对技术带来的伦理选择',
      'AI/外星/异种生命应有独立的认知逻辑，不可只是人类的镜像',
    ],
    clicheWarnings: [
      '避免"技术万能论"——所有问题都能靠发明解决',
      '避免外星人/AI只是换皮的反派',
    ],
    tensionShape: 'rising',
  },
  {
    keywords: ['奇幻', '魔法', '异世界', '西幻', '精灵', '龙'],
    label: '奇幻',
    structureHints: [
      '魔法体系需有规则和代价（不可万能），最好有Sanderson式内在逻辑',
      '世界构建需覆盖种族、地理、信仰、经济，而非只有战斗',
      '史诗感来自小人物卷入大事件，而非一上来就是天选之人',
    ],
    characterHints: [
      '主角的成长应伴随对世界规则认知的深化',
      '不同种族/阵营的角色需有文化差异，不可同质化',
    ],
    clicheWarnings: [
      '避免"勇者打魔王"的扁平善恶二元论',
      '避免魔法沦为"放大版拳头"只用于战斗',
    ],
    tensionShape: 'wave',
  },
]

const GENERIC_FALLBACK: GenreProfile = {
  keywords: [],
  label: '通用',
  structureHints: [
    '结构应服务于故事内核，而非套用固定模板',
    '每章需推进至少一条主线或人物弧线',
  ],
  characterHints: [
    '角色需有清晰的欲望和恐惧，且两者应形成内在冲突',
  ],
  clicheWarnings: [
    '避免无代价的胜利和无逻辑的转折',
  ],
  tensionShape: 'wave',
}

export function matchGenreProfiles(genre: string): GenreProfile[] {
  const g = genre.toLowerCase().trim()
  if (!g) return [GENERIC_FALLBACK]

  const matched = GENRE_PROFILES.filter((profile) =>
    profile.keywords.some((kw) => g.includes(kw)),
  )
  return matched.length > 0 ? matched : [GENERIC_FALLBACK]
}

export function buildGenrePromptInjection(profiles: GenreProfile[]): string {
  if (profiles.length === 0) return ''

  const sections: string[] = []
  for (const p of profiles) {
    if (p.structureHints.length > 0) {
      sections.push(`【${p.label}结构指导】${p.structureHints.join('；')}`)
    }
    if (p.characterHints.length > 0) {
      sections.push(`【${p.label}角色指导】${p.characterHints.join('；')}`)
    }
    if (p.clicheWarnings.length > 0) {
      sections.push(`【${p.label}避雷】${p.clicheWarnings.join('；')}`)
    }
  }
  sections.push(`【张力曲线偏好】${profiles.map((p) => p.tensionShape).join('+')}`)

  return sections.join('\n')
}
