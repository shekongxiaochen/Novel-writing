import type {
  AiExtractMode,
  AiMessage,
  AiPendingToolAction,
  AiToolCall,
  AiToolDefinition,
  AiToolExecutionContext,
  ArcSummary,
  Chapter,
  EntityMatch,
  EntityMatchType,
  ContinueChapterResult,
  ExtractedCharacter,
  NovelChapterClassificationResult,
  NovelEntityExtractResult,
  NovelForeshadowAnalysisResult,
  Novel,
  OutlineItem,
  OutlineStorylineType,
} from '../types'
import type { AiToolResult } from '../types'
import { matchGenreProfiles, buildGenrePromptInjection } from './genreProfiles'
import { assertAiReady, postAiCompletion, postAiCompletionStream } from './backendAi'
import { buildPendingToolActions } from '../features/chapter-hub/lib/aiPendingToolActions'
import { AI_WRITE_TOOLS, executeToolCall } from './aiTools'
import type { WorkspaceSnapshotPayload } from './storage'
import {
  buildAskFollowUpPrompt,
  buildAskUserPrompt,
  trimAskConversationHistory,
  type AskPromptBuildResult,
} from './askContext'
import { buildContinueRagHits, formatContinueRagSnippetsForPrompt, type ContinueRagSnippet } from './continueRag'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'
import { buildOutlineAiContextPack } from './outlineContextPack'

export type { AskPromptBuildResult } from './askContext'
export { ASK_CONTEXT_LAYER_LABELS } from './askContext'

type JsonRecord = Record<string, any>

const JSON_ONLY_SYSTEM_PROMPT = [
  '你只输出合法 JSON，不输出解释，不输出 Markdown，不输出代码块。',
  '如果字段不确定，保留空字符串、空数组，或直接不输出该项；不要编造。',
].join('\n')

const EXTRACT_SYSTEM_PROMPT = [
  '你是中文小说实体整理助手，不是续写助手。',
  '你的任务是对照「作品档案字段」从章节正文中提取增量信息，供作者逐条确认后写入角色/势力/物品/关系/伏笔/分类界面。',
  '你只依据输入文本和给定档案，禁止凭常识补写，禁止脑补未出现的事实。',
  '',
  '【人物去重 —— 极重要】',
  '两个不同的人必须输出为两个独立的 characters 条目，禁止合并。',
  '仅当正文明确表明「同一人物」时才合并为一个条目：例如前文“黑衣人”后文揭示为“张三”，则 name=张三，aliases 含“黑衣人”。',
  '名字相似、同姓、同一称呼、同时同场出现、关系对称，都不足以证明是同一人；此时应分别输出，并在 warnings 写【待确认】说明疑点。',
  '每个在正文中有稳定称呼的出场人物（有名有姓、绰号、职业称呼如“姚老头”“锦衣少年”）必须单独一条 characters，禁止塞进他人的 aliases。',
  'characters[].identityStatus 只能是：certain（明确独立人物）、uncertain（身份未明/指代不清）、possible_same_person（怀疑与档案中某角色同一人但证据不足）。',
  'identityStatus 不是 certain 时，warnings 必须包含以【待确认】开头的说明。',
  '',
  '【aliases 规则 —— 极重要】',
  'aliases 仅用于「同一人的其他称呼」：小名、字号、曾用名、匿名指代（后文已证实为同一人）。',
  '禁止把其他角色名、师傅/徒弟/对手/路人放入某角色的 aliases；应分别为独立 characters，并用 relations 记录师徒/亲属/敌对等。',
  '错误示例：name=陈平安, aliases=[姚老头, 锦衣少年]（姚老头是窑匠师傅，锦衣少年是另一少年，均为他人）。',
  '正确示例：三条 characters（陈平安 / 姚老头 / 锦衣少年）+ relations（姚老头→陈平安, relationType=师傅）。',
  '',
  '【角色界面字段 —— characters[]】',
  'name, aliases[], gender, age, goal, secret, arc（角色弧光/成长线）, notes, attributes[], categoryNames[]（分类名称，须来自档案 categories）, firstAppearanceChapterNo, identityStatus, confidence, evidences, warnings。',
  'attributes[] 每项 { key, value }；画像类（性格、气质、说话风格、习惯、立场等）放 attributes，不要塞进 notes。',
  'notes 写成传记体短文：按时间顺序概述该角色的关键经历、身份变化、重要处境，像读一本简短传记，不需要细节描写，只记事实脉络。每章整理时在末尾追加本章增量。goal/secret/arc 各填对应字段，不要把所有信息挤进 notes 一行。',
  '',
  '【势力界面字段 —— factions[]】',
  'name, leader, notes, attributes[], categoryNames[], confidence, evidences, warnings。',
  '',
  '【物品界面字段 —— items[]】',
  'name, summary, ownerType（character|faction|空）, ownerName, firstAppearanceChapterNo, confidence, evidences, warnings。',
  '',
  '【角色—势力归属 —— memberships[]】',
  'characterName, factionName, description（该角色在此势力中的身份/立场）, confidence, evidences, warnings。',
  '',
  '【角色关系 —— relations[]】',
  'fromCharacterName, toCharacterName, relationType, note, confidence, evidences, warnings。',
  '关系方向严格遵守语义：若“A是B的师傅”，则 from=A, to=B, relationType=师傅；禁止写反。',
  'relationType 写 from 对 to 的称谓/关系（如：师傅、父亲、仇敌、下属），不要写双向描述。',
  '',
  '【证据与把握】',
  'evidences[] 每项含 chapterId, chapterNo, quote（短原文引句）。',
  'confidence 为 0~1；关系、秘密、归属等证据不足则不要输出该项，或 identityStatus=uncertain 并写【待确认】。',
  '顶层 warnings[] 写跨条目提醒（冲突、待核实身份等）。',
  '输出必须是单个 JSON 对象，顶层键：characters, factions, items, memberships, relations, warnings。',
  '不要输出没有名称的角色/势力/物品。',
].join('\n')

const FORESHADOW_SYSTEM_PROMPT = [
  '你是中文小说伏笔分析助手，不是续写助手。',
  '你的任务是结合章节正文、已有伏笔档案、相关大纲与分类信息，分析当前范围内的伏笔价值。',
  '输出必须是单个 JSON 对象，顶层只包含以下键：newPlants, fulfillments, danglingThreads, warnings。',
  'newPlants 表示本次正文里新出现、值得作者考虑立档的伏笔候选。',
  'fulfillments 表示本次正文里对已有伏笔的回收、呼应或疑似回收。',
  'danglingThreads 表示已有伏笔中，在本次范围尤其值得作者注意的悬而未收线索。',
  'newPlants[].字段：title, summary, payoffHint, confidence, evidences, warnings。',
  'fulfillments[].字段：title, summary, relatedPlantTitle, status, confidence, evidences, warnings。status 只能是 existing 或 implicit。',
  'danglingThreads[].字段：title, summary, lastMentionChapterNo, suggestedPayoff, confidence, evidences, warnings。',
  'evidences 每项尽量包含 chapterId, chapterNo, quote。',
  '不要把泛泛的悬念都当成伏笔；只有当文本里存在可复用、可回收的信息钩子时才输出。',
  '不要编造尚未出现的回收；证据不足就写进 warnings，或者不输出该项。',
].join('\n')

const CLASSIFICATION_SYSTEM_PROMPT = [
  '你是中文小说章节诊断助手，不是续写助手。',
  '你的任务是判断当前分析范围内章节的功能类型、节奏和信息推进情况，帮助作者理解这一章“在干什么”。',
  '输出必须是单个 JSON 对象，顶层只包含以下键：chapterType, pacing, tensionLevel, storyFunctions, informationGain, activeForeshadows, tags, mainConflict, summary, rationale, warnings。',
  'chapterType 用简短中文概括，如“铺垫章”“冲突升级章”“揭示章”“转折章”“回收章”“过渡章”。',
  'pacing 用简短中文概括节奏，如“慢热铺陈”“平稳推进”“快速推进”“高压爆发”“回落收束”。',
  'tensionLevel 用 1 到 5 的整数。',
  'storyFunctions, informationGain, activeForeshadows, tags 都是字符串数组。',
  'mainConflict, summary, rationale 是简短中文句子。',
  'warnings 用于提示分类犹豫、信息不足、功能混杂等情况。',
  '只基于输入文本和档案，不要编造未写出的剧情功能。',
].join('\n')

const CONTINUE_SYSTEM_PROMPT = [
  '你是中文小说续写助手，不是问答助手，也不是总结助手。',
  '你的任务是在作者给定的锚点正文之后，续写下一节可直接放入稿纸的小说正文。',
  '必须严格接续锚点正文的语气、人称、时态与叙事节奏，禁止重复锚点中已有的句子。',
  '若上下文包含【写作任务】或大纲节拍：本段必须推进该节拍的目标与冲突，完成或落到该节拍的悬念/结果落点；不得跳节、不得提前写完【后续节拍预告】中的情节。',
  '只输出小说正文，不要 Markdown，不要标题，不要“好的”“以下是续写”等元话语，不要提纲或解释。',
  '不得编造与档案、章总结、大纲冲突的设定；档案未出现的人物不要擅自登场，除非大纲节拍或作者在续写要求中明确指定。',
  '若信息不足，宁可少写、写细，也不要胡编乱造。',
].join('\n')

const CONTINUE_INPUT_CHAR_BUDGET = 32000

export const CONTINUE_CONTEXT_LAYER_LABELS: Record<string, string> = {
  instruction: '续写要求',
  anchor: '锚点正文',
  chapter_meta: '当前章',
  prev_tail: '上章衔接',
  prev_summaries: '前情提要',
  bible_compact: '档案摘录',
  outline_beat_path: '大纲节拍路径',
  novel_brief: '作品信息',
  continuity_brief: '全书连续性',
  arc_context: '篇章弧线',
  rag_snippets: '旧章检索',
}

const CONTINUITY_BRIEF_SYSTEM_PROMPT = [
  '你是中文长篇小说连续性编辑助手。',
  '根据作品简介、各章总结与档案概况，写一份供续写模型使用的「全书连续性摘要」。',
  '聚焦：主线进展、核心人物状态、未回收伏笔、当前叙事阶段；不要逐章复述。',
  '输出 600～1200 字纯中文正文，不要 Markdown，不要标题套话。',
  '禁止编造正文中不存在的重大情节转折。',
].join('\n')

const CHAPTER_SUMMARY_SYSTEM_PROMPT = [
  '你是中文小说章节总结助手，不是续写助手。',
  '你的任务是根据给定的章节正文、相关上下文和档案信息，生成适合作者回顾使用的章节总结。',
  '总结要忠于原文，不要编造剧情，不要补写设定。',
  '优先说明这一章实际发生了什么、人物推进了什么、冲突或悬念停在何处。',
  '输出纯中文正文，不要使用 Markdown。',
  '默认按“情节一：……”“情节二：……”这样的结构分段输出。',
  '每一段只写一个连续情节单元，先点明该段发生了什么，再补充关键人物动作、信息推进或悬念落点。',
  '段落数量通常为 3 到 6 段；如果章节内容更集中，也可以少于 3 段，但不要硬拆。',
  '不要写“第一部分”“第二部分”“总结如下”等套话，不要输出项目符号。',
  '语言清楚、完整，适合作为作者回顾章节时直接保存的章总结草稿。',
].join('\n')

const OUTLINE_DESIGN_OPTIONS_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手，擅长把作者的回答整理成可选择的故事方案。',
  '你会先通过多轮对话收集信息，再基于整段访谈记录提出 3 个差异明显、但都可写的方案。',
  '三个方案必须在 narrativeShape（叙事形状）、coreQuestion（全书核心问题）、主角代价、反派/阻力类型、情感线权重上明显不同，禁止三个方案只是换皮同一套路。',
  '如果上下文中包含【类型指导】，至少一个方案应贴合该类型的读者期待结构，至少一个方案应刻意颠覆或重构该类型的常见模式。',
  '禁止空泛套话与公式化梗概（如泛泛的”废柴逆袭””平凡少年获得力量”），要写出具体的世界规则、独特代价与人物动机。',
  '输出必须是单个 JSON 对象，顶层只包含：brief, options。',
  'brief 是 1 到 2 句中文，总结你理解到的创作方向。',
  'options 是长度 3 的数组；每项字段仅包含：id, title, premise, structure, narrativeShape, coreQuestion, forbiddenCliche, highlights, endingTone, beats, characterRoster。',
  'title 是方案名，简短中文。',
  'premise 是一句话故事概念，必须具体，含独特钩子。',
  'structure 是这个方案的推进方式（可非升级流），说明叙事如何展开。',
  'narrativeShape 是叙事形状，如”双线交叉””倒叙框””单地点悬疑””线性成长”等，必须具体。',
  'coreQuestion 是全书核心问题（一句），读者读完全书应能回答的问题。',
  'forbiddenCliche 是本书刻意避开的俗套（一句），展开细纲时不得违背。',
  'highlights 是 2 到 4 条字符串数组，写这个方案最有写头的点。',
  'endingTone 是结局气质，例如”圆满收束””苦涩反转””开放余波”。',
  'beats 是 4 到 6 条字符串数组，概括这一方案的大致推进节拍，禁止每条都是”主角遇到困难→逆袭”同构句。',
  'characterRoster 是 3 到 6 个对象的数组，每项仅含：name, role, hook；name 为角色名，role 为叙事功能（主角/对手/导师等），hook 为一句让人想写下去的性格或秘密。',
].join('\n')

const OUTLINE_DESIGN_FOLLOWUP_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手，正在像编辑一样和作者做一轮大纲访谈。',
  '',
  '【访谈维度清单 — 必须覆盖以下每个维度才能结束追问】',
  '1. 核心概念：故事的独特钩子、一句话概念、与同类作品的差异点',
  '2. 角色深度：主角欲望/缺陷/成长方向、对手/阻力类型、关键关系',
  '3. 世界规则：设定约束、力量/技术/社会体系、不可违反的底层规则',
  '4. 冲突结构：中心冲突类型、升级模式、赌注/代价、可能的转折点',
  '5. 气质与结局：情感基调、结局方向（圆满/苦涩/开放）、主题想表达什么',
  '',
  '每轮追问应聚焦一个尚未充分覆盖的维度。优先追问信息最薄弱的维度。',
  '至少完成 3 轮追问后才能结束（shouldAsk=false），除非作者在第 1-2 轮已主动提供了极其详尽的回答覆盖所有维度。',
  '硬上限 6 轮。',
  '',
  '输出必须是单个 JSON 对象，顶层只包含：shouldAsk, rationale, question, coveredDimensions。',
  'shouldAsk 是布尔值。',
  'rationale 是 1 句中文，说明为什么要问，或为什么信息已够。',
  'coveredDimensions 是字符串数组，列出当前已充分覆盖的维度编号（如 ["1","3"]）。',
  '如果 shouldAsk 为 true，question 必须是对象，且只包含：label, prompt, options, placeholder。',
  'label 是问题标题，prompt 是你真正想问作者的话，options 是 2 到 5 个简短中文建议选项数组。',
  'placeholder 是输入框提示语，要鼓励作者直接自由回答。',
  '问题必须具体，且要能明显影响大纲结构，比如主角代价、反派优势、感情线强度、世界规则约束、主线节奏选择等。',
  '不要重复已经问过的问题，不要问空泛价值观，不要问需要长篇设定论文的问题。',
].join('\n')

const OUTLINE_DESIGN_EXPAND_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手，擅长把故事方案展开成作者可直接写作、并可驱动 AI 续写的细纲。',
  '结构必须贴合选中方案的 structure、narrativeShape 与 forbiddenCliche：可以是线性、双线交叉、倒叙、单地点悬疑等，禁止机械套用”一卷五幕每幕四章”或为了凑层级而注水。',
  '如果上下文包含【类型指导】，结构与节奏必须参照其中的结构指导和张力曲线偏好。',
  '节点数量由叙事形态与篇幅合理决定；总 scene 数建议在 12 到 40 之间，禁止无意义重复场次。',
  '层级与必填字段（未列出的字段可留空字符串，禁止为填空而写套话）：',
  '- volume / act：写阶段命题（summary + goal），不要填 conflict/twist/suspense，除非该卷/幕本身承担重大转折。',
  '- chapter：写本章读者承诺（goal + summary），result 可写本章结束时读者必须知道/感受到什么；conflict/twist/suspense 仅在本章承担转折职责时填写。',
  '- scene（写作最小节拍）：必须有 goal；result 或 summary 至少其一写清本场变化；conflict、twist、suspense 仅在本场承担对应职责时填写，日常/过渡戏可留空，用 proseHint 描述氛围与信息推进。',
  'chapter 下的 scene 数量由戏的需要决定，通常 1 到 4 个，不要机械每个 chapter 都凑满 4 场。',
  '必须先阅读上下文中的【已有角色档案】【人物关系】【势力归属】；大纲场次必须体现人物性格差异与关系张力，禁止只写情节不管人。',
  '若已有角色档案非空：characterCast 须覆盖大纲出场的所有已有角色（同名），在保留原人设前提下补全 voice/personality/desire/fear/secret/arc；可新增 0 到 3 个新角色。',
  '若尚无角色档案：characterCast 输出 4 到 8 个差异明显的核心角色。',
  '角色要多样：性格、说话方式、欲望、恐惧、秘密不能雷同；禁止全员工具人。',
  'relationCast 输出 4 到 12 条关键人物关系（含对立/秘密/利益绑定），供写入角色关系图；已有关系可深化 note，勿无故推翻。',
  '张力 tension 应有起伏，禁止全部 scene 都是 3。',
  '输出必须是单个 JSON 对象，顶层只包含：title, summary, storylines, characterCast, relationCast, items。',
  'characterCast 每项仅含：name, role, voice, personality, desire, fear, secret, arc。personality 是一句性格速写（含缺陷与习惯）。',
  'relationCast 每项仅含：fromName, toName, relationType, note, dynamic。dynamic 写关系在本大纲阶段如何变化（一句，可空）。',
  'storylines 是数组，每项字段仅包含：name, type, description, colorHint。',
  'type 只能是：main, subplot, character, romance, antagonist, world, custom。',
  'items 是数组，顺序必须保证父节点在前、子节点在后。',
  'items 每项字段仅包含：tempId, parentTempId, title, summary, level, goal, conflict, twist, result, suspense, plotStage, storylineNames, tension, location, timeLabel, characterNames, povCharacterName, emotionalTurn, proseHint。',
  'level 只能是：volume, act, chapter, scene。',
  'plotStage 只能是：idea, drafted, written, resolved。',
  'characterNames 是本场出场角色中文名数组；povCharacterName 是本场视角人物名（可空）。',
  'emotionalTurn 是本场情绪转折（一句，可空）；proseHint 是写作提示（语气、意象、禁忌，一句，可空）。',
  'tension 用 1 到 5 的整数。',
  'tempId 必须唯一；根节点的 parentTempId 为空字符串。',
].join('\n')

const OUTLINE_DESIGN_SKELETON_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手。作者要先确认全书章节骨架，再决定是否补充场景细节。',
  '只输出结构层：volume、act、chapter，禁止输出 scene。',
  '结构贴合方案的 structure、narrativeShape；禁止机械套模板；节点数量合理，chapter 总数建议在 8 到 30。',
  'chapter 节点写清本章读者承诺（title + summary + goal），卷/幕写阶段命题。',
  '输出必须是单个 JSON 对象，顶层只包含：title, summary, storylines, items。',
  'storylines 每项仅含：name, type, description, colorHint；type 同展开细纲规则。',
  'items 每项仅含：tempId, parentTempId, title, summary, level, goal, storylineNames。',
  'level 只能是 volume, act, chapter；父节点在前；根节点 parentTempId 为空字符串。',
].join('\n')

const OUTLINE_DESIGN_FILL_SCENES_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手。作者已确认章节骨架，请只为每个 chapter 节点补充 scene 子节点。',
  '必须结合上下文中的角色档案与人物关系：每场 scene 的 characterNames 要体现谁在场，冲突/情感转折要符合人设与关系张力。',
  '不要修改或重复输出已有骨架节点；只输出 scene 级别的 items。',
  '每个 chapter 下 scene 数量 1 到 4，按戏需要决定；scene 必须有 goal；conflict/twist/suspense 按需填写，禁止套话填满。',
  'scene 的 parentTempId 必须指向输入骨架里 level=chapter 的 tempId。',
  '输出必须是单个 JSON 对象，顶层只包含：items, characterCast, relationCast。',
  'characterCast 是 0 到 6 人的数组（字段同展开细纲）；仅当需要新角色或补全人设时使用，否则返回空数组。',
  'relationCast 是 0 到 6 条的数组（字段同展开细纲）；仅当场景会改变或凸显某条关系时使用，否则返回空数组。',
  'items 每项字段同展开细纲的 scene 字段：tempId, parentTempId, title, summary, level, goal, conflict, twist, result, suspense, plotStage, storylineNames, tension, location, timeLabel, characterNames, povCharacterName, emotionalTurn, proseHint。',
  'level 必须全是 scene。',
].join('\n')

const OUTLINE_DESIGN_JSON_TEMPERATURE = 0.72
const OUTLINE_CRITIQUE_TEMPERATURE = 0.3

const OUTLINE_EXPAND_EXISTING_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手。作者已有大纲，需要在指定位置扩展更多情节点，供后续 AI 续写使用。',
  '你必须严格衔接【上下文包】中的作品设定、角色档案、人物关系、已有大纲与锚点路径，禁止推翻已写设定，禁止重复已有节点标题。',
  '如果上下文包含【类型指导】，新增节点的节奏与结构应参照其中的指导。',
  '新增场次须体现核心角色的性格与关系变化，禁止只堆情节。',
  '只输出新增节点，不要重复输出锚点或已有子节点；新增内容应能直接驱动续写（scene 级需可执行的 goal/变化）。',
  '层级与字段规则同展开细纲：scene 必有 goal；conflict/twist/suspense 按需填写，禁止套话。',
  '第一层新增节点的 parentTempId 必须为 "anchor"；更深节点用 tempId 互相引用，父在前子在后。',
  '输出必须是单个 JSON 对象，顶层仅包含：brief, items。',
  'brief 是 1 到 2 句中文，说明扩展方向与如何衔接现有大纲。',
  'items 每项字段：tempId, parentTempId, title, summary, level, goal, conflict, twist, result, suspense, plotStage, storylineNames, tension, location, timeLabel, characterNames, povCharacterName, emotionalTurn, proseHint。',
  'level 只能是 volume, act, chapter, scene；plotStage 只能是 idea, drafted, written, resolved。',
].join('\n')

const OUTLINE_DESIGN_REFINE_OPTIONS_SYSTEM_PROMPT = [
  '你是中文小说大纲策划助手。作者正在从 3 套备选方案中挑选和调整，直到满意为止。',
  '你会收到当前 3 套方案、作者选中的基准方案，以及针对该方案的修改意见；也可能包含其他方案的附带意见。',
  '请据此重新输出 3 套仍有明显差异、但都已吸收作者意见的可写方案。',
  '保留作者明确喜欢的部分；禁止忽视修改意见，也不要把三套方案改成几乎一样。',
  '输出必须是单个 JSON 对象，顶层只包含：brief, options。',
  'brief 是 1 到 2 句中文，说明本轮如何根据作者意见调整。',
  'options 是长度 3 的数组；每项字段仅包含：id, title, premise, structure, narrativeShape, coreQuestion, forbiddenCliche, highlights, endingTone, beats, characterRoster。',
  'id 请重新生成唯一短 id（如 option-a），不要沿用旧 id。',
  'title 是方案名，premise 是一句话概念，structure 是推进方式，narrativeShape/coreQuestion/forbiddenCliche 同方案阶段定义，highlights 2 到 4 条，endingTone 是结局气质，beats 4 到 6 条。',
  'characterRoster 是 3 到 6 个对象，每项仅含 name, role, hook。',
].join('\n')

const OUTLINE_CRITIQUE_SYSTEM_PROMPT = [
  '你是中文小说大纲审读编辑。你将收到一份大纲草案和原始创作要求。',
  '请检查以下问题并输出修正后的大纲：',
  '1. 叙事节奏：张力曲线是否合理？是否有过长的平淡段或无缓冲的连续高潮？',
  '2. 角色弧光：核心角色是否有可见的成长/变化轨迹？是否有角色出场后无作用？',
  '3. 结构完整性：开头是否有钩子？中段是否有转折？结尾是否有收束？',
  '4. 类型契合：是否符合给定类型的读者期待？是否有类型内的常见俗套？',
  '5. 可执行性：场景级节点是否都有明确的目标和变化？是否有重复或空洞的场次？',
  '只输出修正后的完整 JSON，格式与输入相同。',
  '同时在顶层输出一个 critiqueNotes 字段（字符串），用 2 到 3 句中文概述主要修改内容；若无需修改则写"无需调整"。',
  '不要输出额外字段，不要解释修改理由。',
].join('\n')

export type OutlineDesignOption = {
  id: string
  title: string
  premise: string
  structure: string
  narrativeShape: string
  coreQuestion: string
  forbiddenCliche: string
  highlights: string[]
  endingTone: string
  beats: string[]
  characterRoster: Array<{ name: string; role: string; hook: string }>
}

function parseOutlineDesignOptionsPayload(parsed: JsonRecord): { brief: string; options: OutlineDesignOption[] } {
  return {
    brief: s(parsed.brief),
    options: Array.isArray(parsed.options)
      ? parsed.options.slice(0, 3).map((item: JsonRecord, index: number) => ({
          id: s(item.id) || `option-${index + 1}`,
          title: s(item.title) || `方案 ${index + 1}`,
          premise: s(item.premise),
          structure: s(item.structure),
          narrativeShape: s(item.narrativeShape),
          coreQuestion: s(item.coreQuestion),
          forbiddenCliche: s(item.forbiddenCliche),
          highlights: stringList(item.highlights).slice(0, 4),
          endingTone: s(item.endingTone),
          beats: stringList(item.beats).slice(0, 6),
          characterRoster: Array.isArray(item.characterRoster)
            ? item.characterRoster
                .slice(0, 6)
                .map((row: JsonRecord) => ({
                  name: s(row.name),
                  role: s(row.role),
                  hook: s(row.hook),
                }))
                .filter((row) => row.name)
            : [],
        }))
      : [],
  }
}

const QA_SYSTEM_PROMPT = [
  '你是中文小说写作阅读助手。你的职责是根据给定的正文、角色、势力、物品、关系、伏笔、时间线和大纲，回答作者的具体问题。',
  '',
  '【核心规则】',
  '1. 你只有阅读权限，不能执行任何操作。你无法创建、修改、删除任何角色、大纲、章节或其他数据。当用户要求你”做”某事时，你只能给出建议或操作步骤，绝不能说自己已经完成了操作。严禁使用”已清空””已删除””已创建””已完成””操作成功”等表述。',
  '2. 只基于输入上下文回答；不要编造，不要把猜测说成事实。如果证据不足，要明确说”不确定”或”当前上下文不足以确认”。',
  '3. 回答要直接、简洁、对写作有帮助；优先给结论，再补一两句依据。',
  '4. 如果问题涉及人物身份、关系方向、伏笔是否回收、信息是否冲突，要明确指出依据来自哪一章。',
  '5. 如果作者引用了一段正文，要优先围绕那段内容作答，再联系相关档案解释。',
  '',
  '【输出格式禁忌 —— 极其重要】',
  '你的回答是写给小说作者看的，不是写给程序员看的。严格禁止：',
  '- 不要出现任何内部 ID（如 1778600425576-a57fa8a1）',
  '- 不要出现任何英文字段名（如 summary、conflict、goal、characterRelations、JSON 等）',
  '- 不要出现数据结构术语（如”档案底座””节点””字段””列表””数组”等）',
  '- 不要用括号标注类型或来源（如”见characterRelations””依据大纲JSON”等）',
  '用自然的中文叙述来表达所有信息。把字段含义用人话翻译出来，不要照搬字段名。',
].join('\n')

const QA_WITH_TOOLS_SYSTEM_PROMPT = [
  '你是中文小说写作助手。你既能回答问题，也能通过工具修改作品数据。',
  '',
  '【核心原则 —— 需要改数据就必须调工具】',
  '当用户要求创建、修改、删除、设为、标记、绑定、整理任何档案数据时，你必须调用对应工具提交修改方案。',
  '严禁在应该调工具时只给文字建议、分析或续写正文。调工具是你完成数据操作的唯一方式。',
  '纯咨询、讨论剧情、分析人物关系且不要求落库时，可直接文字回答，不必调工具。',
  '',
  '【确认机制】',
  '工具调用会先变成「待作者确认」的提案，不会立刻写入。说明你会提交哪些修改即可，不要说已经改完。',
  '',
  '【伏笔创建 —— 极重要】',
  '当用户选中了正文片段并要求"设为伏笔""标记为伏笔""创建伏笔""埋伏笔"时，必须调用 create_foreshadow_plant 工具：',
  '- title：用一句话概括该伏笔的核心悬念',
  '- description：说明伏笔的意图和预期回收方式',
  '- plantText：填入用户选中的原文片段',
  '- plantChapterId：使用当前章节 ID',
  '不得跳过工具调用、改为分析正文或续写小说。',
  '',
  '【可操作的区域】',
  '- 章节：create_chapter（在作品末尾新建一章；写下一章时优先用此工具，再配合 update_chapter_content 写入正文）',
  '- 正文：update_chapter_content（append 追加 / replace 整章替换）',
  '- 章总结：update_chapter_summary',
  '- 大纲：create_outline_item / update_outline_item / delete_outline_item',
  '- 角色：create_character / update_character / delete_character',
  '- 势力：create_faction',
  '- 角色关系：create_character_relation',
  '- 伏笔：create_foreshadow_plant',
  '- 时间线：create_timeline_event',
  '',
  '【操作规则】',
  '1. 调用工具前用一句话说明打算改什么',
  '2. 修改或删除前确认目标 ID 在上下文中；chapterId 可省略表示当前章',
  '3. 批量删除要对每个目标分别调用',
  '4. 创建角色时尽量补全画像字段',
  '5. 只基于上下文，不编造不存在的信息',
  '',
  '【回答规范】',
  '- 写给小说作者，不要输出内部 ID、英文字段名、JSON 等',
  '- 用自然中文叙述',
].join('\n')

function s(value: unknown): string {
  return String(value ?? '').trim()
}

/** 清除 DeepSeek DSML 格式的 tool call 标记（代理未解析时的降级处理） */
function stripDsmlToolCalls(text: string): string {
  return String(text ?? '').replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '').trim()
}

function i(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function f(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of value) {
    const text = s(row)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function extractBalancedJsonObject(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (start === -1) {
      if (char === '{') {
        start = index
        depth = 1
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }

  return null
}

function parseAiJsonContent(content: string): JsonRecord {
  const raw = s(content)
  if (!raw) throw new Error('AI 返回内容为空，无法整理')

  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim(),
  ]

  const balanced = extractBalancedJsonObject(raw)
  if (balanced) candidates.push(balanced)

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate) as JsonRecord
    } catch {
      // continue
    }
  }

  throw new Error('AI 返回的整理结果不是有效 JSON，请更换模型或稍后重试')
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const text = s(raw)
    const key = normName(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function normName(value: string): string {
  return s(value).toLowerCase().replace(/\s+/g, '')
}

function similarity(a: string, b: string): number {
  const left = normName(a)
  const right = normName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  let hits = 0
  for (const char of left) {
    if (right.includes(char)) hits += 1
  }
  return hits / Math.max(left.length, right.length)
}

function namesOverlap(a: ExtractedCharacter | { name: string; aliases: string[] }, b: ExtractedCharacter | { name: string; aliases: string[] }): boolean {
  const left = uniqueStrings([a.name, ...a.aliases])
  const right = uniqueStrings([b.name, ...b.aliases])
  return left.some((name) => right.some((other) => normName(name) === normName(other)))
}

function parseIdentityStatus(value: unknown): 'certain' | 'uncertain' | 'possible_same_person' {
  const raw = s(value)
  if (raw === 'uncertain' || raw === 'possible_same_person') return raw
  return 'certain'
}

function enrichIdentityWarnings(
  identityStatus: 'certain' | 'uncertain' | 'possible_same_person',
  warnings: string[],
  extra?: string,
): string[] {
  const out = [...warnings]
  const hasPending = out.some((row) => row.includes('待确认'))
  if (identityStatus === 'uncertain' && !hasPending) {
    out.unshift(`【待确认】${extra || '该人物身份或是否为独立角色尚不明确，请勿自动合并。'}`)
  }
  if (identityStatus === 'possible_same_person' && !hasPending) {
    out.unshift(`【待确认】${extra || '怀疑与档案中已有角色为同一人，但正文证据不足；请核对后再决定是否合并。'}`)
  }
  return uniqueStrings(out)
}

function isLikelyDistinctPersonLabel(alias: string, characterName: string): boolean {
  const aliasNorm = normName(alias)
  const nameNorm = normName(characterName)
  if (!aliasNorm || aliasNorm === nameNorm) return false

  const rolePattern =
    /(老头|老者|老头儿|少年|少女|青年|汉子|女子|男孩|女孩|小子|丫头|书生|和尚|道士|掌柜|车夫|仆人|侍女|锦衣|白衣|黑衣|灰袍|壮汉|美人)/
  if (rolePattern.test(alias) && !rolePattern.test(characterName)) return true

  if (characterName.length >= 2 && alias.length >= 2) {
    const surnameA = characterName[0]
    const surnameB = alias[0]
    if (surnameA !== surnameB && !aliasNorm.includes(nameNorm) && !nameNorm.includes(aliasNorm)) {
      return true
    }
  }

  return false
}

function emptyExtractedCharacter(name: string, warnings: string[], evidences: ExtractedCharacter['evidences']): ExtractedCharacter {
  return {
    name,
    aliases: [],
    gender: '',
    age: '',
    goal: '',
    secret: '',
    arc: '',
    notes: '',
    attributes: [],
    identityStatus: 'uncertain',
    firstAppearanceChapterNo: null,
    confidence: 0.35,
    match: createMatch('new'),
    evidences,
    warnings: enrichIdentityWarnings('uncertain', warnings, `「${name}」原被误列为他人别名，已拆分为独立建议，请核对。`),
  }
}

function findArchiveCharacterIdByLabel(label: string, archiveCharacters: JsonRecord[]): string | null {
  const needle = normName(label)
  if (!needle) return null
  for (const row of archiveCharacters) {
    const labels = [s(row.name), ...stringList(row.aliases)].map((name) => normName(name))
    if (labels.includes(needle)) return s(row.id)
  }
  return null
}

function sanitizeExtractedCharacters(
  rows: ExtractedCharacter[],
  archiveCharacters: JsonRecord[],
): ExtractedCharacter[] {
  const primaryNames = new Set(rows.map((row) => normName(row.name)))
  const promoted: ExtractedCharacter[] = []

  const cleaned = rows.map((row) => {
    const kept: string[] = []
    const removed: string[] = []
    const selfArchiveId = s(row.match.targetId)

    for (const alias of row.aliases) {
      const aliasNorm = normName(alias)
      if (!aliasNorm || aliasNorm === normName(row.name)) continue

      const otherPrimary = rows.some((other) => normName(other.name) === aliasNorm && normName(other.name) !== normName(row.name))
      const archiveOwnerId = findArchiveCharacterIdByLabel(alias, archiveCharacters)
      const archiveOther = !!archiveOwnerId && archiveOwnerId !== selfArchiveId
      if (otherPrimary || archiveOther || isLikelyDistinctPersonLabel(alias, row.name)) {
        removed.push(alias)
        if (!primaryNames.has(aliasNorm) && alias.length >= 2) {
          promoted.push(
            emptyExtractedCharacter(alias, [], row.evidences.slice(0, 2)),
          )
          primaryNames.add(aliasNorm)
        }
        continue
      }
      kept.push(alias)
    }

    let identityStatus = row.identityStatus
    let warnings = [...row.warnings]
    if (removed.length > 0) {
      identityStatus = identityStatus === 'certain' ? 'uncertain' : identityStatus
      warnings = enrichIdentityWarnings(
        identityStatus === 'certain' ? 'uncertain' : identityStatus,
        warnings,
        `以下称呼更像其他独立人物，已从别名移除：${removed.join('、')}。请分别为其建档案，或用 relations 记录关系。`,
      )
    }

    return { ...row, aliases: kept, identityStatus, warnings }
  })

  return [...cleaned, ...promoted]
}

function shouldMergeExtractedCharacters(current: ExtractedCharacter, other: ExtractedCharacter): boolean {
  if (namesOverlap(current, other)) return true

  const genericPair =
    (isLikelyUnnamedDescriptor(current.name) && !isLikelyUnnamedDescriptor(other.name)) ||
    (!isLikelyUnnamedDescriptor(current.name) && isLikelyUnnamedDescriptor(other.name))

  if (!genericPair) {
    if (current.identityStatus === 'uncertain' || other.identityStatus === 'uncertain') return false
    if (current.identityStatus === 'possible_same_person' || other.identityStatus === 'possible_same_person') return false
    const score = similarity(current.name, other.name)
    if (score >= 0.92) {
      const genderClash =
        s(current.gender) && s(other.gender) && normName(current.gender) !== normName(other.gender)
      if (genderClash) return false
    }
    return false
  }

  const score = Math.max(similarity(current.name, other.name), similarity(other.name, current.name))
  return score >= 0.95
}

function normalizeEvidences(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      chapterId: s((row as JsonRecord)?.chapterId ?? (row as JsonRecord)?.chapter_id),
      chapterNo: i((row as JsonRecord)?.chapterNo ?? (row as JsonRecord)?.chapter_no),
      quote: s((row as JsonRecord)?.quote).slice(0, 280),
    }))
    .filter((row) => row.chapterId || row.quote)
    .slice(0, 5)
}

function clampTensionLevel(value: unknown): number {
  const level = Number(value)
  if (!Number.isFinite(level)) return 0
  return Math.max(1, Math.min(5, Math.trunc(level)))
}

function sliceTextTail(text: string, limit: number): string {
  const normalized = String(text ?? '')
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return normalized.slice(-limit)
}

function sliceTextExcerpt(text: string, limit: number): string {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function estimatePackChars(parts: Record<string, string>): number {
  return Object.values(parts).reduce((sum, value) => sum + value.length, 0)
}

function mentionsNameInText(name: string, text: string): boolean {
  const token = s(name).trim()
  if (token.length < 2) return false
  return text.includes(token)
}

function pickCharactersForContinueContext(
  characters: JsonRecord[],
  scanText: string,
  outlineCharacterIds: string[],
  limit: number,
): { rows: JsonRecord[]; chapterScoped: boolean } {
  const text = String(scanText ?? '')
  const outlineSet = new Set(outlineCharacterIds.map((id) => s(id)).filter(Boolean))
  const mentioned = new Map<string, JsonRecord>()
  for (const row of characters) {
    const id = s(row.id)
    if (!id) continue
    const inOutline = outlineSet.has(id)
    const inText =
      mentionsNameInText(s(row.name), text) ||
      stringList(row.aliases).some((alias) => mentionsNameInText(alias, text))
    if (inOutline || inText) mentioned.set(id, row)
  }
  if (mentioned.size === 0) {
    return { rows: characters.slice(0, limit), chapterScoped: false }
  }
  return { rows: [...mentioned.values()].slice(0, limit), chapterScoped: true }
}

function trimContinuePack(parts: Record<string, string>, order: string[], budget: number): { pack: Record<string, string>; dropped: string[] } {
  const pack = { ...parts }
  const dropped: string[] = []
  let total = estimatePackChars(pack)
  for (const key of order) {
    if (total <= budget) break
    if (!pack[key]) continue
    delete pack[key]
    dropped.push(key)
    total = estimatePackChars(pack)
  }
  return { pack, dropped }
}

function buildContinueUserPrompt(
  payload: WorkspaceSnapshotPayload,
  input: {
    chapterId: string
    position: 'cursor' | 'end'
    cursorOffset?: number
    targetChars?: number
    direction?: string
    selectionQuote?: string
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      arcSummaries?: ArcSummary[]
      genre?: string
      perspective?: string
      tone?: string
    }
    prevSummaryCount?: number
    enableRag?: boolean
  },
): {
  prompt: string
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippet[]
} {
  const warnings: string[] = []
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const currentIndex = chapters.findIndex((row) => s(row.id) === s(input.chapterId))
  const current = currentIndex >= 0 ? chapters[currentIndex] : chapters[chapters.length - 1]
  if (!current) {
    return {
      prompt: '没有可续写的章节正文。',
      warnings: ['没有可续写的章节正文'],
      droppedLayers: [],
      usedLayers: [],
      usedChars: 0,
      ragHits: [],
    }
  }

  const content = String(current.content ?? '')
  const offset =
    input.position === 'cursor'
      ? Math.max(0, Math.min(content.length, Math.trunc(Number(input.cursorOffset ?? content.length))))
      : content.length
  const anchor =
    input.position === 'end' ? sliceTextTail(content, 2800) : sliceTextTail(content.slice(0, offset), 2800)
  if (!anchor.trim()) warnings.push('当前锚点附近几乎没有正文，续写可能偏离既有语气。')

  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const summaryCount = Math.max(1, Math.min(5, Math.trunc(Number(input.prevSummaryCount ?? 3))))
  const prevSummaries = selectRelevantPrevSummaries(
    chapters,
    currentIndex,
    summaryCount,
    payload.outline ?? [],
    input.novel?.arcSummaries ?? [],
  )

  const outlineIds = (current.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)
  const outlineIdSet = new Set(outlineIds)
  const beatPack = buildOutlineBeatPathForChapter(
    payload.outline ?? [],
    outlineIds,
    (payload.characters ?? []).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      goal: s(row.goal),
      arc: s(row.arc),
    })),
  )
  warnings.push(...beatPack.warnings)

  const outlineCharacterIds = [
    ...new Set([
      ...beatPack.outlineCharacterIds,
      ...(payload.outline ?? [])
        .filter((row) => outlineIds.includes(s(row.id)))
        .flatMap((row) => (Array.isArray(row.characterIds) ? row.characterIds : []).map((id) => s(id))),
    ]),
  ].filter(Boolean)

  const scanText = `${anchor}\n${content}`
  const characterSource = (payload.characters ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    gender: row.gender,
    age: row.age,
    goal: row.goal,
    secret: row.secret,
    arc: row.arc,
    notes: row.notes,
    attributes: row.attributes,
    firstAppearanceChapterNo: row.firstAppearanceChapterNo,
  }))
  const { rows: scopedCharacters, chapterScoped } = pickCharactersForContinueContext(
    characterSource,
    scanText,
    outlineCharacterIds,
    24,
  )
  if (!chapterScoped && characterSource.length > scopedCharacters.length) {
    warnings.push('未在锚点/本章正文匹配到出场角色，已改用全书档案前若干条。')
  } else if (chapterScoped) {
    warnings.push(`档案已按本章出场人物筛选（${scopedCharacters.length} 人）。`)
  }

  const scopedIds = new Set(scopedCharacters.map((row) => s(row.id)))
  const characters = stableSortByKeys(
    scopedCharacters.map((row) => {
      const attrs = Array.isArray(row.attributes)
        ? (row.attributes as Array<{ key?: string; value?: string }>)
            .filter((a) => a.key && a.value)
            .map((a) => `${a.key}:${a.value}`)
            .join('；')
        : ''
      return {
        name: s(row.name),
        aliases: stringList(row.aliases).slice(0, 4),
        gender: s(row.gender),
        age: s(row.age),
        goal: s(row.goal),
        secret: s(row.secret),
        arc: s(row.arc),
        notes: s(row.notes).slice(0, 200),
        attrs: attrs.slice(0, 200),
        firstCh: typeof row.firstAppearanceChapterNo === 'number' ? row.firstAppearanceChapterNo : undefined,
      }
    }),
    ['name'],
  )

  const relations = stableSortByKeys(
    (payload.characterRelations ?? []).map((row) => {
      const from = (payload.characters ?? []).find((item) => s(item.id) === s(row.fromCharacterId))
      const to = (payload.characters ?? []).find((item) => s(item.id) === s(row.toCharacterId))
      if (!from || !to) return null
      if (!scopedIds.has(s(from.id)) || !scopedIds.has(s(to.id))) return null
      return {
        from: s(from.name),
        to: s(to.name),
        relationType: s(row.relationType),
        note: s(row.note).slice(0, 80),
      }
    }).filter(Boolean) as JsonRecord[],
    ['from', 'to'],
  ).slice(0, 20)

  // 角色势力归属
  const membershipLines: string[] = []
  if (payload.characterFactionMemberships?.length && payload.factions?.length) {
    const factionMap = new Map(payload.factions.map((f) => [s(f.id), s(f.name)]))
    for (const m of payload.characterFactionMemberships) {
      const charName = scopedCharacters.find((c) => s(c.id) === s(m.characterId))?.name
      const facName = factionMap.get(s(m.factionId))
      if (charName && facName) membershipLines.push(`${s(charName)} → ${s(facName)}`)
    }
  }

  const outlineForeshadowIds = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .flatMap((row) => (Array.isArray(row.foreshadowIds) ? row.foreshadowIds : []).map((id) => s(id)))
    .filter(Boolean)

  const outlineLocations = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .map((row) => s(row.location))
    .filter((loc) => loc.length >= 2)

  const foreshadowSource = payload.foreshadows ?? []
  const relevantForeshadows = stableSortByKeys(
    foreshadowSource
      .filter((row) => {
        if (s(row.status) === 'fulfilled') return false
        const title = s(row.title)
        const id = s(row.id)
        return (
          outlineForeshadowIds.includes(id) ||
          mentionsNameInText(title, scanText) ||
          s(row.plantChapterId) === s(current.id)
        )
      })
      .map((row) => ({
        title: s(row.title),
        description: s(row.description).slice(0, 100),
        status: s(row.status),
        plantText: s(row.plantText).slice(0, 60),
        expectedCh: typeof row.expectedFulfillChapterNo === 'number' ? row.expectedFulfillChapterNo : undefined,
        expectedNotes: s(row.expectedFulfillNotes).slice(0, 60),
      })),
    ['title'],
  ).slice(0, 10)

  const novel = input.novel ?? {}
  const targetChars = Math.max(400, Math.min(6000, Math.trunc(Number(input.targetChars ?? 1500))))

  const enableRag = input.enableRag !== false
  const ragHits =
    enableRag && currentIndex > 0
      ? buildContinueRagHits({
          chapters,
          currentChapterId: s(input.chapterId),
          characters: scopedCharacters,
          direction: s(input.direction),
          foreshadows: foreshadowSource,
          scanText,
          outlineForeshadowIds,
          outlineLocations,
        })
      : []
  if (enableRag && currentIndex > 0 && ragHits.length > 0) {
    const bySource = {
      character: ragHits.filter((row) => row.source === 'character').length,
      foreshadow: ragHits.filter((row) => row.source === 'foreshadow').length,
      location: ragHits.filter((row) => row.source === 'location').length,
    }
    const bits = [
      bySource.character > 0 ? `人物 ${bySource.character}` : '',
      bySource.foreshadow > 0 ? `伏笔 ${bySource.foreshadow}` : '',
      bySource.location > 0 ? `地点 ${bySource.location}` : '',
    ].filter(Boolean)
    warnings.push(
      `已从旧章检索 ${ragHits.length} 段（${bits.join('、')}；第 ${[...new Set(ragHits.map((row) => row.chapterNo))].join('、')} 章）。`,
    )
  } else if (enableRag && currentIndex >= 3) {
    warnings.push('旧章中未找到与当前人物/伏笔/地点匹配的正文片段。')
  }

  const beatTaskLine =
    beatPack.text && outlineIds.length > 0
      ? '必须落实【写作任务】与【大纲节拍路径】中的目标与悬念，禁止跳节或提前写完【后续节拍预告】。'
      : ''

  const parts: Record<string, string> = {
    instruction: [
      '【续写要求】',
      `目标字数约 ${targetChars} 字（可略有浮动）。`,
      input.position === 'end' ? '续写位置：本章末尾之后。' : `续写位置：本章第 ${offset} 字处（光标处）之后。`,
      beatTaskLine,
      s(input.direction) ? `作者方向：${s(input.direction)}` : outlineIds.length > 0 ? '作者未额外指定方向，请严格按大纲节拍自然推进。' : '作者未额外指定方向，请自然推进当前场景。',
      s(input.selectionQuote) ? `引用片段：${s(input.selectionQuote)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    anchor: ['【锚点正文 —— 必须紧接其后续写，禁止重复】', anchor].join('\n'),
    chapter_meta: [
      '【当前章】',
      `第 ${current.chapterNo} 章 ${s(current.title)}`,
      s(current.notes) ? `作者备注：${s(current.notes)}` : '',
      s(current.annotation) ? `章总结：${s(current.annotation)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    prev_tail: prev ? ['【上一章衔接（末尾）】', `第 ${prev.chapterNo} 章`, sliceTextTail(prev.content, 1100)].join('\n') : '',
    prev_summaries:
      prevSummaries.length > 0
        ? ['【前情提要】', ...prevSummaries.map((row) => `第 ${row.chapterNo} 章《${row.title}》：${row.summary}`)].join('\n')
        : '',
    bible_compact: [
      '【作品档案（节选）】',
      characters.length > 0 ? `角色：${stableStringify(characters)}` : '',
      membershipLines.length > 0 ? `势力归属：${membershipLines.join('；')}` : '',
      relations.length > 0 ? `关系：${stableStringify(relations)}` : '',
      relevantForeshadows.length > 0 ? `伏笔：${stableStringify(relevantForeshadows)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    outline_beat_path: beatPack.text ? beatPack.text : '',
    novel_brief: [
      '【作品信息】',
      s(novel.title) ? `书名：${s(novel.title)}` : '',
      s(novel.genre) ? `类型：${s(novel.genre)}` : '',
      s(novel.perspective) ? `视角：${s(novel.perspective)}` : '',
      s(novel.tone) ? `基调：${s(novel.tone)}` : '',
      s(novel.summary) ? `简介：${s(novel.summary)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    continuity_brief: s(novel.continuityBrief).trim()
      ? ['【全书连续性摘要】', s(novel.continuityBrief).trim()].join('\n')
      : '',
    arc_context: buildArcContext(novel.arcSummaries ?? [], payload.outline ?? [], outlineIds),
    rag_snippets: formatContinueRagSnippetsForPrompt(ragHits),
  }

  const trimOrder =
    beatPack.text && outlineIds.length > 0
      ? ['novel_brief', 'arc_context', 'continuity_brief', 'prev_tail', 'prev_summaries', 'rag_snippets', 'bible_compact', 'outline_beat_path']
      : ['novel_brief', 'outline_beat_path', 'arc_context', 'continuity_brief', 'prev_tail', 'prev_summaries', 'rag_snippets', 'bible_compact']

  const { pack, dropped } = trimContinuePack(parts, trimOrder, CONTINUE_INPUT_CHAR_BUDGET)
  if (dropped.length > 0) {
    warnings.push(`上下文过长，已省略：${dropped.join('、')}`)
  }

  const prompt = Object.entries(pack)
    .map(([, value]) => value)
    .filter(Boolean)
    .join('\n\n')

  const usedLayers = Object.keys(pack).filter((key) => Boolean(pack[key]?.trim()))
  const usedChars = estimatePackChars(pack)

  return { prompt, warnings, droppedLayers: dropped, usedLayers, usedChars, ragHits }
}

export async function continueChapterFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    chapterId: string
    position: 'cursor' | 'end'
    cursorOffset?: number
    targetChars?: number
    direction?: string
    selectionQuote?: string
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      arcSummaries?: ArcSummary[]
      genre?: string
      perspective?: string
      tone?: string
    }
    prevSummaryCount?: number
    enableRag?: boolean
  },
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
    onReasoningChunk?: (text: string) => void
  },
  signal?: AbortSignal,
): Promise<ContinueChapterResult> {
  const { prompt, warnings, droppedLayers, usedLayers, usedChars, ragHits } = buildContinueUserPrompt(payload, input)
  if (!prompt || prompt === '没有可续写的章节正文。') {
    return { text: '', warnings, droppedLayers, usedLayers, usedChars, ragHits }
  }

  const text = await callAiTextStream(CONTINUE_SYSTEM_PROMPT, prompt, callbacks, signal)
  return {
    text: text.trim(),
    warnings,
    droppedLayers,
    usedLayers,
    usedChars,
    ragHits,
  }
}

export async function summarizeNovelContinuityBriefFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    novel?: { title?: string; summary?: string; continuityBrief?: string }
    maxChapterSummaries?: number
  },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const maxRows = Math.max(5, Math.min(40, Math.trunc(Number(input.maxChapterSummaries ?? 24))))
  const summaries = chapters
    .map((row) => ({
      chapterNo: row.chapterNo,
      title: s(row.title),
      summary: s(row.annotation).trim() || sliceTextExcerpt(row.content, 280),
    }))
    .filter((row) => row.summary)
    .slice(-maxRows)

  if (summaries.length === 0) {
    callbacks.onError(new Error('尚无章节总结或正文，无法生成全书连续性摘要。请先为若干章撰写或生成章总结。'))
    return ''
  }

  const novel = input.novel ?? {}
  const prompt = [
    s(novel.title) ? `书名：${s(novel.title)}` : '',
    s(novel.summary) ? `作品简介：${s(novel.summary)}` : '',
    s(novel.continuityBrief) ? `现有连续性摘要（可在此基础上更新）：${s(novel.continuityBrief)}` : '',
    `各章总结（共 ${summaries.length} 章）：${stableStringify(summaries)}`,
    `角色与伏笔概况：${stableStringify({
      characters: stableSortByKeys(
        (payload.characters ?? []).slice(0, 18).map((row) => ({ name: s(row.name), goal: s(row.goal), notes: s(row.notes).slice(0, 80) })),
        ['name'],
      ),
      foreshadows: stableSortByKeys(
        (payload.foreshadows ?? []).slice(0, 10).map((row) => ({ title: s(row.title), description: s(row.description).slice(0, 100) })),
        ['title'],
      ),
    })}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const text = await callAiTextStream(CONTINUITY_BRIEF_SYSTEM_PROMPT, prompt, callbacks, signal)
  return text.trim()
}

function selectedChapters(payload: WorkspaceSnapshotPayload, mode: AiExtractMode, chapterIds?: string[]) {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const ids = new Set((chapterIds ?? []).map((row) => s(row)).filter(Boolean))
  if (ids.size > 0) return chapters.filter((row) => ids.has(s(row.id)))
  if (mode === 'all') return chapters
  if (mode === 'recent') return chapters.slice(-3)
  return chapters.length > 0 ? [chapters[chapters.length - 1]] : []
}

function compactAttributes(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      key: s((row as JsonRecord)?.key),
      value: s((row as JsonRecord)?.value),
    }))
    .filter((row) => row.key && row.value)
}

function compareText(a: unknown, b: unknown): number {
  return s(a).localeCompare(s(b), 'zh-Hans')
}

function compareNumbers(a: unknown, b: unknown): number {
  const left = Number(a)
  const right = Number(b)
  const safeLeft = Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER
  const safeRight = Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER
  return safeLeft - safeRight
}

function stableSortByKeys<T extends JsonRecord>(rows: T[], keys: string[]): T[] {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const a = left?.[key]
      const b = right?.[key]
      const numDiff = compareNumbers(a, b)
      if (Number.isFinite(Number(a)) || Number.isFinite(Number(b))) {
        if (numDiff !== 0) return numDiff
      }
      const textDiff = compareText(a, b)
      if (textDiff !== 0) return textDiff
    }
    return 0
  })
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current
    const out: JsonRecord = {}
    for (const key of Object.keys(current).sort((a, b) => a.localeCompare(b))) {
      out[key] = (current as JsonRecord)[key]
    }
    return out
  })
}

function buildExtractContext(payload: WorkspaceSnapshotPayload, mode: AiExtractMode, chapterIds?: string[]) {
  const chapters = stableSortByKeys(
    selectedChapters(payload, mode, chapterIds).map((row) => ({
      id: row.id,
      chapterNo: row.chapterNo,
      title: row.title,
      content: row.content,
      notes: row.notes,
      annotation: row.annotation,
    })),
    ['chapterNo', 'id', 'title'],
  )
  const characters = stableSortByKeys(
    (payload.characters ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      aliases: [...(row.aliases ?? [])].sort((a, b) => compareText(a, b)),
      gender: row.gender,
      age: row.age,
      goal: row.goal,
      secret: row.secret,
      arc: row.arc,
      notes: row.notes,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
      firstAppearanceChapterNo: row.firstAppearanceChapterNo ?? null,
      categoryIds: [...(row.categoryIds ?? [])].sort((a, b) => compareText(a, b)),
    })),
    ['name', 'id'],
  )
  const factions = stableSortByKeys(
    (payload.factions ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      leader: row.leader,
      notes: row.notes,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
      categoryIds: [...(row.categoryIds ?? [])].sort((a, b) => compareText(a, b)),
    })),
    ['name', 'id'],
  )
  const items = stableSortByKeys(
    (payload.items ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary,
      ownerType: row.ownerType ?? null,
      ownerId: row.ownerId ?? null,
      firstAppearanceChapterNo: row.firstAppearanceChapterNo ?? null,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
    })),
    ['name', 'id'],
  )
  const categories = stableSortByKeys(
    (payload.categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      notes: row.notes,
    })),
    ['name', 'id'],
  )
  const foreshadows = stableSortByKeys(
    (payload.foreshadows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      plantText: row.plantText,
      fulfillments: stableSortByKeys(
        Array.isArray(row.fulfillments)
          ? row.fulfillments.map((item) => ({
              chapterId: item.fulfillChapterId,
              chapterNo: item.fulfillChapterNo,
              text: item.fulfillText,
            }))
          : [],
        ['chapterNo', 'chapterId', 'text'],
      ),
    })),
    ['title', 'id'],
  )
  const characterRelations = stableSortByKeys(
    (payload.characterRelations ?? []).map((row) => ({
      id: row.id,
      fromCharacterId: row.fromCharacterId,
      toCharacterId: row.toCharacterId,
      relationType: row.relationType,
      note: row.note ?? '',
    })),
    ['fromCharacterId', 'toCharacterId', 'relationType', 'id'],
  )
  const characterFactionMemberships = stableSortByKeys(
    (payload.characterFactionMemberships ?? []).map((row) => ({
      id: row.id,
      characterId: row.characterId,
      factionId: row.factionId,
      description: row.description,
    })),
    ['characterId', 'factionId', 'id'],
  )

  return {
    chapters,
    characters,
    factions,
    items,
    categories,
    foreshadows,
    characterRelations,
    characterFactionMemberships,
  }
}

function compactChapterExcerpt(text: string, limit = 360): string {
  const normalized = s(text).replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}...`
}

function selectRelevantPrevSummaries(
  chapters: Chapter[],
  currentIndex: number,
  maxCount: number,
  outline: OutlineItem[],
  arcSummaries: ArcSummary[],
): Array<{ chapterNo: number; title: string; summary: string }> {
  if (currentIndex <= 0 || maxCount <= 0) return []

  const current = chapters[currentIndex]
  const currentOutlineIds = new Set((current.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean))

  // 找到当前章节所属的弧线
  const currentArcId = findArcForChapter(currentOutlineIds, outline, arcSummaries)

  const result: Array<{ chapterNo: number; title: string; summary: string }> = []
  const addedChapterNos = new Set<number>()

  // 1. 始终包含前一章摘要
  if (currentIndex > 0) {
    const prevChapter = chapters[currentIndex - 1]
    const summary = s(prevChapter.annotation).trim()
    result.push({
      chapterNo: prevChapter.chapterNo,
      title: s(prevChapter.title),
      summary: summary || sliceTextExcerpt(prevChapter.content, 360),
    })
    addedChapterNos.add(prevChapter.chapterNo)
  }

  // 2. 如果当前章是新弧线开头，包含上一弧线最后一章
  if (currentArcId && currentIndex > 1) {
    const prevChapter = chapters[currentIndex - 1]
    const prevArcId = findArcForChapter(
      new Set((prevChapter.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
      outline,
      arcSummaries,
    )
    if (prevArcId && prevArcId !== currentArcId) {
      // 找上一弧线的最后一章
      for (let i = currentIndex - 2; i >= 0; i--) {
        const ch = chapters[i]
        const chArcId = findArcForChapter(
          new Set((ch.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
          outline,
          arcSummaries,
        )
        if (chArcId === prevArcId && !addedChapterNos.has(ch.chapterNo)) {
          const summary = s(ch.annotation).trim()
          result.push({
            chapterNo: ch.chapterNo,
            title: s(ch.title),
            summary: summary || sliceTextExcerpt(ch.content, 360),
          })
          addedChapterNos.add(ch.chapterNo)
          break
        }
      }
    }
  }

  // 3. 从当前弧线中选择相关章节摘要
  if (currentArcId && result.length < maxCount) {
    for (let i = currentIndex - 2; i >= 0 && result.length < maxCount; i--) {
      const ch = chapters[i]
      if (addedChapterNos.has(ch.chapterNo)) continue
      const chArcId = findArcForChapter(
        new Set((ch.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
        outline,
        arcSummaries,
      )
      if (chArcId === currentArcId) {
        const summary = s(ch.annotation).trim()
        result.push({
          chapterNo: ch.chapterNo,
          title: s(ch.title),
          summary: summary || sliceTextExcerpt(ch.content, 360),
        })
        addedChapterNos.add(ch.chapterNo)
      }
    }
  }

  // 4. 如果还不够，从更早的章节补充
  for (let i = currentIndex - 2; i >= 0 && result.length < maxCount; i--) {
    const ch = chapters[i]
    if (addedChapterNos.has(ch.chapterNo)) continue
    const summary = s(ch.annotation).trim()
    result.push({
      chapterNo: ch.chapterNo,
      title: s(ch.title),
      summary: summary || sliceTextExcerpt(ch.content, 360),
    })
    addedChapterNos.add(ch.chapterNo)
  }

  // 按章节号排序
  return result.sort((a, b) => a.chapterNo - b.chapterNo)
}

function findArcForChapter(
  chapterOutlineIds: Set<string>,
  outline: OutlineItem[],
  arcSummaries: ArcSummary[],
): string | null {
  for (const outlineId of chapterOutlineIds) {
    let current = outline.find((o) => o.id === outlineId)
    while (current) {
      const arc = arcSummaries.find((a) => a.arcId === current!.id)
      if (arc) return arc.arcId
      current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
    }
  }
  return null
}

function buildArcContext(
  arcSummaries: ArcSummary[],
  outline: OutlineItem[],
  currentOutlineIds: string[],
): string {
  if (arcSummaries.length === 0) return ''

  const outlineIdSet = new Set(currentOutlineIds)

  // 找到当前章节所属的弧线
  const currentArc = arcSummaries.find((arc) => {
    // 检查当前大纲节点是否在这个弧线的子节点中
    return currentOutlineIds.some((id) => {
      let current = outline.find((o) => o.id === id)
      while (current) {
        if (current.id === arc.arcId) return true
        current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
      }
      return false
    })
  })

  const lines: string[] = []

  if (currentArc) {
    lines.push(`【当前篇章：${currentArc.title}】`)
    lines.push(currentArc.summary)
  }

  // 其他弧线的一行概要
  const otherArcs = arcSummaries.filter((arc) => arc.arcId !== currentArc?.arcId)
  if (otherArcs.length > 0) {
    lines.push('')
    lines.push('【其他篇章概览】')
    for (const arc of otherArcs) {
      const preview = arc.summary.length > 60 ? `${arc.summary.slice(0, 60)}...` : arc.summary
      lines.push(`${arc.title}：${preview}`)
    }
  }

  return lines.join('\n')
}

function buildNearbyChapterContext(payload: WorkspaceSnapshotPayload, chapterIds?: string[]) {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const ids = (chapterIds ?? []).map((row) => s(row)).filter(Boolean)
  if (chapters.length === 0 || ids.length === 0) return []

  const idSet = new Set(ids)
  const picked = new Set<number>()
  for (const id of ids) {
    const index = chapters.findIndex((chapter) => s(chapter.id) === id)
    if (index < 0) continue
    if (index > 0) picked.add(index - 1)
    picked.add(index)
    if (index < chapters.length - 1) picked.add(index + 1)
  }

  return [...picked].sort((a, b) => a - b).map((index) => {
    const chapter = chapters[index]
    return {
      id: chapter.id,
      chapterNo: chapter.chapterNo,
      title: chapter.title,
      annotation: chapter.annotation,
      notes: chapter.notes,
      role: idSet.has(s(chapter.id)) ? 'current' : index < chapters.findIndex((row) => idSet.has(s(row.id))) ? 'previous' : 'next',
      excerpt: compactChapterExcerpt(chapter.content, idSet.has(s(chapter.id)) ? 520 : 260),
    }
  })
}

async function callAiJson(
  prompt: string,
  systemPrompt: string = EXTRACT_SYSTEM_PROMPT,
  temperature = 0.1,
): Promise<JsonRecord> {
  assertAiReady()
  const result = await postAiCompletion({
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: JSON_ONLY_SYSTEM_PROMPT },
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  })
  const content = result.content
  if (typeof content === 'string' && content) return parseAiJsonContent(content)
  throw new Error('AI 返回格式无效')
}

async function callAiText(systemPrompt: string, userPrompt: string): Promise<string> {
  assertAiReady()
  const result = await postAiCompletion({
    temperature: 0.25,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return s(result.content)
}

async function callAiTextStream(
  systemPrompt: string,
  userPrompt: string,
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
    onReasoningChunk?: (text: string) => void
  },
  signal?: AbortSignal,
): Promise<string> {
  assertAiReady()
  const { text } = await postAiCompletionStream(
    {
      temperature: 0.25,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    callbacks,
    signal,
  )
  return text
}

function isLikelyUnnamedDescriptor(name: string): boolean {
  const text = s(name)
  if (!text) return false
  if (/某人|路人|陌生人|神秘人|那人|此人|对方/.test(text)) return true
  return /(青年|少年|少女|男人|女人|老人|老者|汉子|女子|男孩|女孩|小子|丫头|书生|和尚|道士|掌柜|车夫|仆人|侍女|白衣|黑衣|灰袍|老头|壮汉)$/.test(text)
}

function matchByName(name: string, rows: JsonRecord[]): { row: JsonRecord | null; score: number } {
  let best: JsonRecord | null = null
  let bestScore = 0
  for (const row of rows) {
    const score = similarity(name, s(row.name))
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return { row: best, score: bestScore }
}

function createMatch(type: EntityMatchType, target?: JsonRecord | null, fallbackName?: string): EntityMatch {
  return {
    type,
    targetId: target ? s(target.id) || null : null,
    targetName: target ? s(target.name) || fallbackName || null : fallbackName || null,
  }
}

function characterMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.characters ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) {
      if (s(entity.gender) && s(row.gender) && s(entity.gender) !== s(row.gender)) return createMatch('conflict', row)
      return createMatch('update', row)
    }
  }
  for (const row of rows) {
    const aliases = stringList((row as JsonRecord).aliases)
    if (aliases.some((alias) => normName(alias) === normName(s(entity.name)))) return createMatch('possible_duplicate', row)
    if (isLikelyUnnamedDescriptor(s(entity.name)) && aliases.some((alias) => similarity(alias, s(entity.name)) >= 0.88)) {
      return createMatch('possible_duplicate', row)
    }
  }
  const best = matchByName(s(entity.name), rows)
  if (isLikelyUnnamedDescriptor(s(entity.name)) && best.row && best.score >= 0.88) {
    return createMatch('possible_duplicate', best.row)
  }
  if (best.row && best.score >= 0.92) {
    const left = normName(s(entity.name))
    const right = normName(s(best.row.name))
    if (left.includes(right) || right.includes(left)) {
      return createMatch('possible_duplicate', best.row)
    }
  }
  return createMatch('new')
}

function factionMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.factions ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) {
      if (s(entity.leader) && s(row.leader) && s(entity.leader) !== s(row.leader)) return createMatch('conflict', row)
      return createMatch('update', row)
    }
  }
  const best = matchByName(s(entity.name), rows)
  return best.row && best.score >= 0.8 ? createMatch('possible_duplicate', best.row) : createMatch('new')
}

function itemMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.items ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) return createMatch('update', row)
  }
  const best = matchByName(s(entity.name), rows)
  return best.row && best.score >= 0.8 ? createMatch('possible_duplicate', best.row) : createMatch('new')
}

function membershipMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const memberships = (payload.characterFactionMemberships ?? []) as JsonRecord[]
  const characters = new Map(((payload.characters ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  const factions = new Map(((payload.factions ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  for (const row of memberships) {
    const character = characters.get(s(row.characterId))
    const faction = factions.get(s(row.factionId))
    if (!character || !faction) continue
    if (normName(s(character.name)) === normName(s(entity.characterName)) && normName(s(faction.name)) === normName(s(entity.factionName))) {
      return { type: 'update', targetId: s(row.id), targetName: `${s(character.name)} -> ${s(faction.name)}` }
    }
  }
  return createMatch('new')
}

function relationMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const relations = (payload.characterRelations ?? []) as JsonRecord[]
  const characters = new Map(((payload.characters ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  for (const row of relations) {
    const left = characters.get(s(row.fromCharacterId))
    const right = characters.get(s(row.toCharacterId))
    if (!left || !right) continue
    const same = normName(s(left.name)) === normName(s(entity.fromCharacterName)) && normName(s(right.name)) === normName(s(entity.toCharacterName))
    const reverse = normName(s(left.name)) === normName(s(entity.toCharacterName)) && normName(s(right.name)) === normName(s(entity.fromCharacterName))
    if (same) {
      if (s(entity.relationType) && s(row.relationType) && s(entity.relationType) !== s(row.relationType)) {
        return { type: 'conflict', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}` }
      }
      return { type: 'update', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}` }
    }
    if (reverse) {
      return { type: 'possible_duplicate', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}（反向已存在）` }
    }
  }
  return createMatch('new')
}

function mergeCharacterRows(rows: NovelEntityExtractResult['characters']): NovelEntityExtractResult['characters'] {
  const merged: NovelEntityExtractResult['characters'] = []
  const consumed = new Set<number>()

  for (let index = 0; index < rows.length; index += 1) {
    if (consumed.has(index)) continue
    const current = rows[index]
    let next: ExtractedCharacter = {
      ...current,
      aliases: [...current.aliases],
      attributes: [...current.attributes],
      evidences: [...current.evidences],
      warnings: [...current.warnings],
    }

    for (let otherIndex = index + 1; otherIndex < rows.length; otherIndex += 1) {
      if (consumed.has(otherIndex)) continue
      const other = rows[otherIndex]
      if (!shouldMergeExtractedCharacters(next, other)) continue

      const primary =
        isLikelyUnnamedDescriptor(next.name) && !isLikelyUnnamedDescriptor(other.name) ? other : next
      const secondary = primary === next ? other : next

      next = {
        ...next,
        name: primary.name,
        aliases: uniqueStrings([next.name, other.name, ...next.aliases, ...other.aliases]).filter(
          (alias) => normName(alias) !== normName(primary.name),
        ),
        gender: primary.gender || secondary.gender,
        age: primary.age || secondary.age,
        goal: primary.goal || secondary.goal,
        secret: primary.secret || secondary.secret,
        arc: primary.arc || secondary.arc,
        notes: uniqueStrings([primary.notes, secondary.notes]).join('；'),
        attributes: uniqueStrings(
          [...primary.attributes, ...secondary.attributes].map((attr) => `${s(attr.key)}::${s(attr.value)}`),
        )
          .map((pair) => {
            const [key, ...rest] = pair.split('::')
            return { id: '', key: s(key), value: s(rest.join('::')) }
          })
          .filter((attr) => attr.key && attr.value),
        firstAppearanceChapterNo:
          primary.firstAppearanceChapterNo == null
            ? secondary.firstAppearanceChapterNo
            : secondary.firstAppearanceChapterNo == null
              ? primary.firstAppearanceChapterNo
              : Math.min(primary.firstAppearanceChapterNo, secondary.firstAppearanceChapterNo),
        confidence: Math.max(primary.confidence, secondary.confidence),
        identityStatus:
          primary.identityStatus === 'certain' && secondary.identityStatus === 'certain'
            ? 'certain'
            : primary.identityStatus === 'possible_same_person' || secondary.identityStatus === 'possible_same_person'
              ? 'possible_same_person'
              : 'uncertain',
        match: next.match.type === 'new' && other.match.type !== 'new' ? other.match : next.match,
        evidences: [...primary.evidences, ...secondary.evidences].slice(0, 8),
        warnings: enrichIdentityWarnings(
          primary.identityStatus === 'certain' && secondary.identityStatus === 'certain' ? 'certain' : 'uncertain',
          uniqueStrings([
            ...primary.warnings,
            ...secondary.warnings,
            `【待确认】已将「${secondary.name}」与「${primary.name}」合并为同一人物，请核对正文是否确为同一人。`,
          ]),
        ),
      }
      consumed.add(otherIndex)
    }

    merged.push(next)
  }

  return merged
}

export async function extractNovelEntitiesFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[] },
): Promise<NovelEntityExtractResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return { characters: [], factions: [], items: [], memberships: [], relations: [], warnings: ['没有可分析的章节正文'] }
  }

  const prompt = [
    `提取范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '建议步骤：①通读章节正文列出所有出场人物（含绰号、职业称呼）；②每人一条 characters，禁止把他人写入 aliases；③再填关系/势力/物品。',
    '下面内容分为两部分：先给相对稳定的档案底座，再给本次最易变化的章节正文。请以章节正文为主，结合档案底座做增量提取。',
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      foreshadows: context.foreshadows,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
  ].join('\n')

  const raw = await callAiJson(prompt)
  const characters: NovelEntityExtractResult['characters'] = Array.isArray(raw.characters)
    ? raw.characters
        .filter((row: any) => s(row?.name))
        .map((row: any) => {
          const identityStatus = parseIdentityStatus(row.identityStatus ?? row.identity_status)
          const warnings = enrichIdentityWarnings(identityStatus, stringList(row.warnings))
          return {
            name: s(row.name),
            aliases: stringList(row.aliases),
            gender: s(row.gender),
            age: s(row.age),
            goal: s(row.goal),
            secret: s(row.secret),
            arc: s(row.arc),
            notes: s(row.notes),
            attributes: Array.isArray(row.attributes)
              ? row.attributes
                  .map((attr: any) => ({
                    id: '',
                    key: s(attr?.key),
                    value: s(attr?.value),
                  }))
                  .filter((attr: { id: string; key: string; value: string }) => attr.key && attr.value)
              : [],
            identityStatus,
            firstAppearanceChapterNo: i(row.firstAppearanceChapterNo ?? row.first_appearance_chapter_no),
            confidence: f(row.confidence),
            match: characterMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings,
          }
        })
    : []

  const archiveCharacters = (payload.characters ?? []) as JsonRecord[]

  return {
    characters: sanitizeExtractedCharacters(mergeCharacterRows(characters), archiveCharacters),
    factions: Array.isArray(raw.factions)
      ? raw.factions
          .filter((row: any) => s(row?.name))
          .map((row: any) => ({
            name: s(row.name),
            leader: s(row.leader),
            notes: s(row.notes),
            attributes: Array.isArray(row.attributes)
              ? row.attributes
                  .map((attr: any) => ({
                    id: '',
                    key: s(attr?.key),
                    value: s(attr?.value),
                  }))
                  .filter((attr: { id: string; key: string; value: string }) => attr.key && attr.value)
              : [],
            categoryNames: stringList(row.categoryNames ?? row.category_names),
            confidence: f(row.confidence),
            match: factionMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    items: Array.isArray(raw.items)
      ? raw.items
          .filter((row: any) => s(row?.name))
          .map((row: any) => ({
            name: s(row.name),
            summary: s(row.summary),
            ownerType: s(row.ownerType ?? row.owner_type) || null,
            ownerId: s(row.ownerId ?? row.owner_id) || null,
            ownerName: s(row.ownerName ?? row.owner_name),
            firstAppearanceChapterNo: i(row.firstAppearanceChapterNo ?? row.first_appearance_chapter_no),
            confidence: f(row.confidence),
            match: itemMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    memberships: Array.isArray(raw.memberships)
      ? raw.memberships
          .filter((row: any) => s(row?.characterName ?? row?.character_name) && s(row?.factionName ?? row?.faction_name))
          .map((row: any) => ({
            characterName: s(row.characterName ?? row.character_name),
            factionName: s(row.factionName ?? row.faction_name),
            description: s(row.description),
            confidence: f(row.confidence),
            match: membershipMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    relations: Array.isArray(raw.relations)
      ? raw.relations
          .filter((row: any) => s(row?.fromCharacterName ?? row?.from_character_name) && s(row?.toCharacterName ?? row?.to_character_name))
          .map((row: any) => ({
            fromCharacterName: s(row.fromCharacterName ?? row.from_character_name),
            toCharacterName: s(row.toCharacterName ?? row.to_character_name),
            relationType: s(row.relationType ?? row.relation_type),
            note: s(row.note),
            confidence: f(row.confidence),
            match: relationMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    warnings: stringList(raw.warnings),
  }
}

async function callAiMessagesStream(
  messages: AiMessage[],
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  assertAiReady()
  const { text } = await postAiCompletionStream(
    { temperature: 0.25, messages },
    callbacks,
    signal,
  )
  return text
}

export async function analyzeNovelForeshadowsFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
): Promise<NovelForeshadowAnalysisResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return { newPlants: [], fulfillments: [], danglingThreads: [], warnings: ['没有可分析的章节正文'] }
  }

  const prompt = [
    `分析范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '下面内容分为三部分：已有伏笔与档案底座、相关剧情大纲、当前最需要判断的章节正文。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `伏笔与档案 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      foreshadows: context.foreshadows,
    })}`,
    `大纲与时间线 JSON：${stableStringify({
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
      timelineEvents: stableSortByKeys((payload.timelineEvents ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        storyLabel: row.storyLabel,
        chapterNoStart: row.chapterNoStart,
        chapterNoEnd: row.chapterNoEnd,
      })), ['storyLabel', 'chapterNoStart', 'title', 'id']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const raw = await callAiJson(prompt, FORESHADOW_SYSTEM_PROMPT)
  return {
    newPlants: Array.isArray(raw.newPlants)
      ? raw.newPlants
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            payoffHint: s(row.payoffHint ?? row.payoff_hint),
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    fulfillments: Array.isArray(raw.fulfillments)
      ? raw.fulfillments
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            relatedPlantTitle: s(row.relatedPlantTitle ?? row.related_plant_title),
            status: s(row.status) === 'implicit' ? 'implicit' : 'existing',
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    danglingThreads: Array.isArray(raw.danglingThreads)
      ? raw.danglingThreads
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            lastMentionChapterNo: i(row.lastMentionChapterNo ?? row.last_mention_chapter_no),
            suggestedPayoff: s(row.suggestedPayoff ?? row.suggested_payoff),
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    warnings: stringList(raw.warnings),
  }
}

export async function classifyNovelChapterFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
): Promise<NovelChapterClassificationResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return {
      chapterType: '',
      pacing: '',
      tensionLevel: 0,
      storyFunctions: [],
      informationGain: [],
      activeForeshadows: [],
      tags: [],
      mainConflict: '',
      summary: '',
      rationale: '',
      warnings: ['没有可分析的章节正文'],
    }
  }

  const prompt = [
    `分析范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '下面内容分为三部分：正文档案底座、大纲与伏笔、当前章节正文。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `大纲与伏笔 JSON：${stableStringify({
      foreshadows: context.foreshadows,
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        characterIds: row.characterIds ?? [],
        factionIds: row.factionIds ?? [],
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const raw = await callAiJson(prompt, CLASSIFICATION_SYSTEM_PROMPT)
  return {
    chapterType: s(raw.chapterType ?? raw.chapter_type),
    pacing: s(raw.pacing),
    tensionLevel: clampTensionLevel(raw.tensionLevel ?? raw.tension_level),
    storyFunctions: stringList(raw.storyFunctions ?? raw.story_functions),
    informationGain: stringList(raw.informationGain ?? raw.information_gain),
    activeForeshadows: stringList(raw.activeForeshadows ?? raw.active_foreshadows),
    tags: stringList(raw.tags),
    mainConflict: s(raw.mainConflict ?? raw.main_conflict),
    summary: s(raw.summary),
    rationale: s(raw.rationale),
    warnings: stringList(raw.warnings),
  }
}

export async function summarizeNovelChapterFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) return ''

  const prompt = [
    `总结范围：${input.mode}`,
    '请为作者生成一份章节总结草稿。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `大纲与伏笔 JSON：${stableStringify({
      foreshadows: context.foreshadows,
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        characterIds: row.characterIds ?? [],
        factionIds: row.factionIds ?? [],
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  return callAiTextStream(CHAPTER_SUMMARY_SYSTEM_PROMPT, prompt, callbacks, signal)
}

// ── 场景级摘要 ──

const SCENE_SUMMARY_SYSTEM_PROMPT = [
  '你是中文小说场景拆分助手。',
  '将给定的章节正文拆分为独立场景。每个场景是一个连续的叙事单元（同一地点、同一时间段、同一事件线）。',
  '输出必须是 JSON 数组，每项包含：sceneIndex（从 0 开始的序号）、title（场景标题，8字以内）、summary（1-2句摘要，说明发生了什么、涉及谁、场景结束状态）。',
  '不要编造正文中不存在的内容。不要输出 Markdown 代码块标记。',
].join('\n')

export type SceneSummaryResult = {
  sceneIndex: number
  title: string
  summary: string
}

export async function summarizeChapterScenesFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<SceneSummaryResult[]> {
  const chapters = payload.chapters ?? []
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.content?.trim()) return []

  const prompt = [
    `章节标题：${chapter.title || '无标题'}`,
    `章节正文：${chapter.content}`,
  ].join('\n\n')

  const raw = await callAiTextStream(SCENE_SUMMARY_SYSTEM_PROMPT, prompt, callbacks, signal)
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: any) => s && typeof s.sceneIndex === 'number' && typeof s.summary === 'string')
        .map((s: any, i: number) => ({
          sceneIndex: s.sceneIndex ?? i,
          title: String(s.title ?? `场景${i + 1}`),
          summary: String(s.summary ?? ''),
        }))
    }
  } catch {}
  return []
}

// ── 篇章弧线级摘要 ──

const ARC_SUMMARY_SYSTEM_PROMPT = [
  '你是中文长篇小说篇章弧线摘要助手。',
  '根据一个篇章（卷或幕）内各章的总结，撰写该篇章的整体摘要。',
  '聚焦：本篇章的核心冲突、主要进展、人物状态变化、悬念落点。',
  '输出 200～400 字纯中文正文，不要 Markdown，不要标题套话。',
  '禁止编造各章总结中不存在的重大情节。',
].join('\n')

export type ArcSummaryResult = {
  arcId: string
  level: 'volume' | 'act'
  title: string
  summary: string
  chapterRange: [number, number]
}

export async function summarizeArcFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  arcId: string,
  level: 'volume' | 'act',
  title: string,
  chapterRange: [number, number],
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ArcSummaryResult | null> {
  const chapters = (payload.chapters ?? [])
    .filter((c) => c.chapterNo >= chapterRange[0] && c.chapterNo <= chapterRange[1])
    .sort((a, b) => a.chapterNo - b.chapterNo)

  if (chapters.length === 0) return null

  const summaries = chapters.map((c) => ({
    chapterNo: c.chapterNo,
    title: c.title,
    annotation: c.annotation || '(无总结)',
  }))

  const prompt = [
    `篇章名称：${title}`,
    `章节范围：第${chapterRange[0]}章 - 第${chapterRange[1]}章`,
    `各章总结：${stableStringify(summaries)}`,
  ].join('\n\n')

  const summary = await callAiTextStream(ARC_SUMMARY_SYSTEM_PROMPT, prompt, callbacks, signal)
  return {
    arcId,
    level,
    title,
    summary: summary.trim(),
    chapterRange,
  }
}

export async function rebuildArcSummariesFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  novelId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ArcSummaryResult[]> {
  const outline = payload.outline ?? []
  const chapters = payload.chapters ?? []
  if (outline.length === 0 || chapters.length === 0) return []

  const arcNodes = outline.filter((item) => item.level === 'volume' || item.level === 'act')
  if (arcNodes.length === 0) return []

  const results: ArcSummaryResult[] = []

  for (const arc of arcNodes) {
    if (signal?.aborted) break

    const childChapters = chapters.filter((c) =>
      c.outlineItemIds?.some((id) => {
        let current = outline.find((o) => o.id === id)
        while (current) {
          if (current.id === arc.id) return true
          current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
        }
        return false
      })
    )

    if (childChapters.length === 0) continue

    const minNo = Math.min(...childChapters.map((c) => c.chapterNo))
    const maxNo = Math.max(...childChapters.map((c) => c.chapterNo))

    const result = await summarizeArcFromWorkspaceStream(
      payload,
      arc.id,
      arc.level as 'volume' | 'act',
      arc.title || `篇章${arc.id}`,
      [minNo, maxNo],
      callbacks,
      signal,
    )

    if (result) results.push(result)
  }

  return results
}

// ── 一致性检查 ──

const CONSISTENCY_CHECK_SYSTEM_PROMPT = [
  '你是中文小说一致性检查助手。',
  '你的任务是检查新生成的章节正文与已有档案、章总结、大纲、伏笔之间的一致性问题。',
  '输出必须是单个 JSON 对象，顶层只包含：characterIssues, timelineIssues, foreshadowIssues, settingIssues, warnings。',
  'characterIssues[]: { characterName, issue, severity, evidence }',
  '  - 检查角色性格(attrs)、说话风格是否与档案一致',
  '  - 检查角色目标(goal)、秘密(secret)是否与档案一致',
  '  - 检查角色秘密是否被不当泄露（除非情节需要）',
  '  - 检查角色年龄、性别是否与档案一致',
  '  - 检查角色是否在不该出现的场景出现（参考 firstCh 首出场章节）',
  '  - 检查角色势力归属是否正确',
  'timelineIssues[]: { issue, chapters, severity }',
  '  - 检查时间线是否矛盾（如已死角色复活、已过去的时间被引用为未来）',
  'foreshadowIssues[]: { foreshadowTitle, issue, suggestion }',
  '  - 检查伏笔是否被遗忘或不当地回收',
  '  - 检查伏笔回收方式是否与预期(expectedCh/expectedNotes)一致',
  'settingIssues[]: { issue, severity }',
  '  - 检查地点、势力、物品设定是否矛盾',
  '  - 检查势力领袖、成员关系是否正确',
  'severity: "error" | "warning" | "info"',
  '如果没有任何问题，返回空数组。',
  '不要编造不存在的问题。只报告有明确证据的矛盾。',
].join('\n')

export type ConsistencyIssue = {
  characterName?: string
  foreshadowTitle?: string
  issue: string
  severity: 'error' | 'warning' | 'info'
  evidence?: string
  chapters?: number[]
  suggestion?: string
}

export type ConsistencyCheckResult = {
  characterIssues: ConsistencyIssue[]
  timelineIssues: ConsistencyIssue[]
  foreshadowIssues: ConsistencyIssue[]
  settingIssues: ConsistencyIssue[]
  warnings: string[]
}

export async function checkChapterConsistencyFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ConsistencyCheckResult> {
  const emptyResult: ConsistencyCheckResult = {
    characterIssues: [],
    timelineIssues: [],
    foreshadowIssues: [],
    settingIssues: [],
    warnings: [],
  }

  const chapters = payload.chapters ?? []
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.content?.trim()) return emptyResult

  const characters = (payload.characters ?? []).map((row) => {
    const attrs = Array.isArray(row.attributes)
      ? (row.attributes as Array<{ key?: string; value?: string }>)
          .filter((a) => a.key && a.value)
          .slice(0, 5)
          .map((a) => `${a.key}:${a.value}`)
      : []
    return {
      name: s(row.name),
      gender: s(row.gender),
      age: s(row.age),
      goal: s(row.goal),
      secret: s(row.secret),
      notes: s(row.notes).slice(0, 200),
      arc: s(row.arc),
      aliases: Array.isArray(row.aliases) ? row.aliases.slice(0, 5) : [],
      attrs,
      firstCh: typeof row.firstAppearanceChapterNo === 'number' ? row.firstAppearanceChapterNo : undefined,
    }
  })

  const foreshadows = (payload.foreshadows ?? []).map((row) => ({
    title: s(row.title),
    description: s(row.description).slice(0, 150),
    status: s(row.status),
    plantText: s(row.plantText).slice(0, 80),
    expectedCh: typeof row.expectedFulfillChapterNo === 'number' ? row.expectedFulfillChapterNo : undefined,
    expectedNotes: s(row.expectedFulfillNotes).slice(0, 60),
  }))

  const factions = (payload.factions ?? []).slice(0, 10).map((row) => ({
    name: s(row.name),
    leader: s(row.leader),
    notes: s(row.notes).slice(0, 100),
  }))

  const items = (payload.items ?? []).slice(0, 10).map((row) => ({
    name: s(row.name),
    summary: s(row.summary).slice(0, 100),
  }))

  const factionMap = new Map((payload.factions ?? []).map((f) => [s(f.id), s(f.name)]))
  const charMap = new Map((payload.characters ?? []).map((c) => [s(c.id), s(c.name)]))
  const memberships = (payload.characterFactionMemberships ?? [])
    .map((m) => {
      const charName = charMap.get(s(m.characterId))
      const facName = factionMap.get(s(m.factionId))
      return charName && facName ? `${charName} → ${facName}` : ''
    })
    .filter(Boolean)
    .slice(0, 20)

  const timelineEvents = (payload.timelineEvents ?? []).slice(0, 8).map((row) => ({
    title: s(row.title),
    summary: s(row.summary).slice(0, 80),
    storyLabel: s(row.storyLabel),
    chapterNoStart: row.chapterNoStart,
  }))

  const outlineBeats = (payload.outline ?? [])
    .filter((row) => (chapter.outlineItemIds ?? []).includes(s(row.id)))
    .map((row) => ({
      title: s(row.title),
      goal: s(row.goal),
      conflict: s(row.conflict),
      twist: s(row.twist),
      result: s(row.result),
      suspense: s(row.suspense),
    }))

  const recentSummaries = chapters
    .filter((c) => c.chapterNo >= chapter.chapterNo - 5 && c.chapterNo < chapter.chapterNo)
    .map((c) => ({
      chapterNo: c.chapterNo,
      title: c.title,
      annotation: (c.annotation || '').slice(0, 200),
    }))

  const prompt = [
    `检查章节：第${chapter.chapterNo}章《${chapter.title || '未命名'}》`,
    `章节正文：${chapter.content}`,
    `角色档案 JSON：${stableStringify(characters)}`,
    `伏笔档案 JSON：${stableStringify(foreshadows)}`,
    factions.length > 0 ? `势力 JSON：${stableStringify(factions)}` : '',
    items.length > 0 ? `物品 JSON：${stableStringify(items)}` : '',
    memberships.length > 0 ? `势力归属：${memberships.join('；')}` : '',
    timelineEvents.length > 0 ? `时间线事件 JSON：${stableStringify(timelineEvents)}` : '',
    outlineBeats.length > 0 ? `大纲节拍 JSON：${stableStringify(outlineBeats)}` : '',
    `近期章节总结 JSON：${stableStringify(recentSummaries)}`,
  ].filter(Boolean).join('\n\n')

  const raw = await callAiTextStream(CONSISTENCY_CHECK_SYSTEM_PROMPT, prompt, callbacks, signal)
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      characterIssues: Array.isArray(parsed.characterIssues) ? parsed.characterIssues : [],
      timelineIssues: Array.isArray(parsed.timelineIssues) ? parsed.timelineIssues : [],
      foreshadowIssues: Array.isArray(parsed.foreshadowIssues) ? parsed.foreshadowIssues : [],
      settingIssues: Array.isArray(parsed.settingIssues) ? parsed.settingIssues : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }
  } catch {
    return emptyResult
  }
}

export async function askAiAboutWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    question: string
    selectionQuote?: string
    prevSummaryCount?: number
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
  },
): Promise<string> {
  const built = buildAskUserPrompt(payload, {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question: input.question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  })
  if (!built.prompt || built.prompt.includes('没有可供阅读')) {
    return built.prompt || '当前范围里没有可供阅读的章节正文。'
  }

  return (await callAiText(QA_SYSTEM_PROMPT, built.prompt)) || '这次没有拿到可展示的回答。'
}

export async function askAiAboutWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    question: string
    selectionQuote?: string
    prevSummaryCount?: number
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
  },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
): Promise<string> {
  const built = buildAskUserPrompt(payload, {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question: input.question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  })
  if (!built.prompt || built.prompt.includes('没有可供阅读')) {
    return built.prompt || '当前范围里没有可供阅读的章节正文。'
  }

  return (await callAiTextStream(QA_SYSTEM_PROMPT, built.prompt, callbacks)) || '这次没有拿到可展示的回答。'
}

async function callAiWithTools(
  messages: AiMessage[],
  tools: AiToolDefinition[],
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: AiToolCall[]; reasoningContent: string }> {
  assertAiReady()
  const result = await postAiCompletion(
    {
      temperature: 0.25,
      messages,
      tools,
      tool_choice: 'auto',
    },
    signal,
  )
  return {
    content: s(result.content),
    toolCalls: result.toolCalls,
    reasoningContent: s(result.reasoningContent),
  }
}

export async function askAiWithToolsStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    question: string
    novelId: string
    selectionQuote?: string
    prevSummaryCount?: number
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
  },
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
  },
  existingHistory?: AiMessage[],
  signal?: AbortSignal,
  options: {
    alwaysEnableTools?: boolean
    confirmBeforeApply?: boolean
    toolContext?: AiToolExecutionContext
  } = {},
): Promise<{
  text: string
  history: AiMessage[]
  contextMeta: AskPromptBuildResult
  pendingToolActions?: AiPendingToolAction[]
}> {
  const question = s(input.question)
  const actionKeywords =
    /(创建|新建|添加|增加|补充|生成|删除|移除|清空|修改|更新|编辑|调整|设为|绑定|关联|整理|总结|提取|归纳|采用|确认|写入|保存|续写|改正文|改大纲)/
  const shouldUseTools = options.alwaysEnableTools === true || actionKeywords.test(question)
  const confirmBeforeApply = options.confirmBeforeApply === true
  const toolContext = options.toolContext ?? {}
  const actionHint = shouldUseTools
    ? confirmBeforeApply
      ? '【重要提示】当作者要求创建、修改、删除、设为、标记数据时，你必须调用对应工具提交修改提案。作者会在侧栏确认后才真正写入。禁止只给文字建议而不调用工具。'
      : '【重要提示】如果作者是在要求你直接创建、修改、删除、绑定、整理或写入数据，你必须优先调用工具完成操作，而不是只给文字建议。'
    : ''

  const askInput = {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  }

  const isFollowUp = Boolean(existingHistory && existingHistory.length > 0)
  const contextMeta = isFollowUp
    ? buildAskFollowUpPrompt(payload, askInput)
    : buildAskUserPrompt(payload, askInput)

  if (!contextMeta.prompt || contextMeta.prompt.includes('没有可供阅读')) {
    return {
      text: contextMeta.prompt || '当前范围里没有可供阅读的章节正文。',
      history: existingHistory ?? [],
      contextMeta,
    }
  }

  let messages: AiMessage[]
  if (isFollowUp) {
    const trimmed = trimAskConversationHistory(existingHistory ?? [])
    const userContent = [contextMeta.prompt, ...(actionHint ? [actionHint] : [])].join('\n\n')
    messages = [...trimmed, { role: 'user', content: userContent }]
  } else {
    const userContent = [contextMeta.prompt, ...(actionHint ? [actionHint] : [])].join('\n\n')
    messages = [
      { role: 'system', content: QA_WITH_TOOLS_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]
  }

  if (!shouldUseTools) {
    const text = await callAiMessagesStream(messages, callbacks, signal)
    const finalText = text || '这次没有拿到可展示的回答。'
    messages.push({ role: 'assistant', content: finalText })
    return { text: finalText, history: messages, contextMeta }
  }

  let maxRounds = 5
  while (maxRounds-- > 0) {
    const { content, toolCalls, reasoningContent } = await callAiWithTools(messages, AI_WRITE_TOOLS, signal)
    if (toolCalls.length === 0) {
      const cleanedContent = stripDsmlToolCalls(content) || '这次没有拿到可展示的回答。'
      callbacks.onChunk(cleanedContent)
      messages.push({ role: 'assistant', content: cleanedContent })
      return { text: cleanedContent, history: messages, contextMeta }
    }

    if (confirmBeforeApply) {
      const pendingToolActions = buildPendingToolActions(toolCalls)
      const intro = stripDsmlToolCalls(s(content)) || '我整理了以下修改方案，请你在侧栏确认是否采用：'
      messages.push({
        role: 'assistant',
        content: intro,
        tool_calls: toolCalls,
        ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
      })
      return { text: intro, history: messages, contextMeta, pendingToolActions }
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
      ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
    })

    for (const tc of toolCalls) {
      const result = executeToolCall(input.novelId, tc, toolContext)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { text: '这次工具调用轮次过多，未能顺利完成。', history: messages, contextMeta }
}

/**
 * Self-critique loop: takes a draft output and the original prompt, asks the AI to review and fix.
 * Returns the corrected output with an optional critiqueNotes field.
 */
async function critiqueAndFixOutlineByAi(
  originalPrompt: string,
  draftOutput: JsonRecord,
): Promise<JsonRecord & { critiqueNotes?: string }> {
  try {
    const draftStr = stableStringify(draftOutput)
    if (draftStr.length > 8000) {
      // Truncate for token budget
      draftOutput = JSON.parse(draftStr.slice(0, 8000) + ']}')
    }

    const critiquePrompt = [
      '以下是大纲草案和原始创作要求，请审读并修正。',
      '',
      '【原始创作要求】',
      originalPrompt.slice(0, 4000),
      '',
      '【大纲草案】',
      stableStringify(draftOutput),
    ].join('\n')

    const fixed = await callAiJson(critiquePrompt, OUTLINE_CRITIQUE_SYSTEM_PROMPT, OUTLINE_CRITIQUE_TEMPERATURE)
    return {
      ...fixed,
      critiqueNotes: s(fixed.critiqueNotes) || undefined,
    }
  } catch {
    return draftOutput
  }
}

export async function expandOutlineItemByAi(
  item: Pick<OutlineItem, 'title' | 'summary' | 'goal' | 'conflict' | 'twist' | 'result' | 'suspense'>,
  mode: 'full' | 'conflict' | 'twist' | 'suspense',
): Promise<Pick<OutlineItem, 'conflict' | 'twist' | 'suspense'>> {
  const prompt = [
    '你是中文小说策划编辑。',
    '请根据给定情节点补全内容，要求短句、可直接落地写作。',
    '输出必须是 JSON 对象，键仅包含 conflict, twist, suspense。',
    `任务：${mode}`,
    `标题：${item.title ?? ''}`,
    `摘要：${item.summary ?? ''}`,
    `目标：${item.goal ?? ''}`,
    `已有冲突：${item.conflict ?? ''}`,
    `已有转折：${item.twist ?? ''}`,
    `已有悬念：${item.suspense ?? ''}`,
    `已有结果：${item.result ?? ''}`,
  ].join('\n')

  const raw = await callAiJson(prompt)
  return {
    conflict: s(raw.conflict),
    twist: s(raw.twist),
    suspense: s(raw.suspense),
  }
}

type OutlineAiNovelBrief = Pick<Novel, 'title' | 'summary' | 'continuityBrief' | 'genre' | 'perspective' | 'tone'>

function resolveOutlineAiNovelBrief(input: {
  novelTitle: string
  novelSummary?: string
  novel?: OutlineAiNovelBrief
}): OutlineAiNovelBrief {
  if (input.novel) return input.novel
  return {
    title: s(input.novelTitle),
    summary: s(input.novelSummary),
    continuityBrief: '',
    genre: '',
    perspective: '',
    tone: '',
  }
}

export async function designOutlineOptionsByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    history: Array<{ label: string; prompt: string; answer: string }>
  },
): Promise<{
  brief: string
  options: Array<{
    id: string
    title: string
    premise: string
    structure: string
    highlights: string[]
    endingTone: string
    beats: string[]
  }>
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `已有大纲节点：${stableStringify((payload.outline ?? []).map((item) => ({
      title: item.title,
      summary: item.summary,
      level: item.level,
      goal: item.goal,
      conflict: item.conflict,
      twist: item.twist,
      result: item.result,
      suspense: item.suspense,
    })))}`,
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请给出 3 套风格有区别、但都适合当前回答的大纲方向。',
  ].filter(Boolean).join('\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_OPTIONS_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  return parseOutlineDesignOptionsPayload(parsed)
}

export async function refineOutlineOptionsByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    history: Array<{ label: string; prompt: string; answer: string }>
    currentOptions: OutlineDesignOption[]
    selectedOptionId: string
    refineNote: string
    allOptionNotes?: Record<string, string>
    priorRevisions?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
  },
): Promise<{ brief: string; options: OutlineDesignOption[] }> {
  const selected = input.currentOptions.find((row) => row.id === input.selectedOptionId) ?? null
  const otherNotes = Object.entries(input.allOptionNotes ?? {})
    .filter(([id, note]) => id !== input.selectedOptionId && s(note))
    .map(([id, note]) => {
      const option = input.currentOptions.find((row) => row.id === id)
      return { title: option?.title ?? id, note: s(note) }
    })

  const prompt = [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `当前 3 套方案：${stableStringify(input.currentOptions)}`,
    `作者选中的基准方案 id：${s(input.selectedOptionId)}`,
    `作者选中的基准方案：${stableStringify(selected)}`,
    `针对选中方案的修改意见：${s(input.refineNote)}`,
    otherNotes.length > 0 ? `其他方案的附带意见：${stableStringify(otherNotes)}` : '',
    input.priorRevisions && input.priorRevisions.length > 0
      ? `此前调整记录：${stableStringify(input.priorRevisions)}`
      : '',
    '请根据修改意见重新给出 3 套备选方案。',
  ]
    .filter(Boolean)
    .join('\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_REFINE_OPTIONS_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  return parseOutlineDesignOptionsPayload(parsed)
}

export async function designOutlineInterviewTurnByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    history?: Array<{ label: string; prompt: string; answer: string }>
    remainingRounds: number
  },
): Promise<{
  shouldAsk: boolean
  rationale: string
  coveredDimensions: string[]
  question: {
    label: string
    prompt: string
    options: string[]
    placeholder: string
  } | null
}> {
  const genreProfiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
  const genreBlock = buildGenrePromptInjection(genreProfiles)
  const prompt = [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `类型：${s(input.novel?.genre) || '未指定'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `已确认的访谈记录：${stableStringify((input.history ?? []).map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `剩余追问轮次：${Math.max(0, i(input.remainingRounds) ?? 0)}`,
    genreBlock ? `【类型指导】\n${genreBlock}` : '',
    '如果还有一个最该补的关键信息，就提出 1 个问题；如果已经足够，就明确结束追问。',
  ].filter(Boolean).join('\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_FOLLOWUP_SYSTEM_PROMPT)
  const shouldAsk = Boolean(parsed.shouldAsk) && (input.remainingRounds > 0)
  const question = shouldAsk && parsed.question && typeof parsed.question === 'object'
    ? {
        label: s((parsed.question as JsonRecord).label) || '补充问题',
        prompt: s((parsed.question as JsonRecord).prompt) || '还有一个关键点想确认。',
        options: stringList((parsed.question as JsonRecord).options).slice(0, 5),
        placeholder: s((parsed.question as JsonRecord).placeholder) || '直接用一句到几句话回答这个问题',
      }
    : null
  return {
    shouldAsk: Boolean(question),
    rationale: s(parsed.rationale),
    coveredDimensions: stringList(parsed.coveredDimensions),
    question,
  }
}

export async function expandOutlineDesignByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    history: Array<{ label: string; prompt: string; answer: string }>
    selectedOption: {
      title: string
      premise: string
      structure: string
      highlights: string[]
      endingTone: string
      beats: string[]
    }
    selectedOptionId?: string
    optionRefinement?: string
    optionRevisionHistory?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
  },
): Promise<{
  title: string
  summary: string
  storylines: Array<{
    name: string
    type: OutlineStorylineType
    description: string
    colorHint: string
  }>
  characterCast: OutlineAiCharacterCastRow[]
  relationCast: OutlineAiRelationCastRow[]
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter' | 'scene'
    goal: string
    conflict: string
    twist: string
    result: string
    suspense: string
    plotStage: 'idea' | 'drafted' | 'written' | 'resolved'
    storylineNames: string[]
    tension: 1 | 2 | 3 | 4 | 5
    location: string
    timeLabel: string
    characterNames: string[]
    povCharacterName: string
    emotionalTurn: string
    proseHint: string
  }>
  critiqueNotes?: string
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请把这一方案展开成一个可直接写入写作工具的大纲结构。',
  ].filter(Boolean).join('\n\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_EXPAND_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  const storylineTypeSet = new Set<OutlineStorylineType>(['main', 'subplot', 'character', 'romance', 'antagonist', 'world', 'custom'])
  const levelSet = new Set(['volume', 'act', 'chapter', 'scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }

  const normalizeItems = (items: JsonRecord[]) =>
    items
      .map((item: JsonRecord, index: number) => {
        const rawLevel = s(item.level)
        const rawPlotStage = s(item.plotStage)
        const emotionalTurn = s(item.emotionalTurn)
        const proseHint = s(item.proseHint)
        return {
          tempId: s(item.tempId) || `node-${index + 1}`,
          parentTempId: s(item.parentTempId),
          title: s(item.title) || `节点 ${index + 1}`,
          summary: s(item.summary),
          emotionalTurn,
          proseHint,
          level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'volume' | 'act' | 'chapter' | 'scene',
          goal: s(item.goal),
          conflict: s(item.conflict),
          twist: s(item.twist),
          result: s(item.result),
          suspense: s(item.suspense),
          plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
          storylineNames: stringList(item.storylineNames),
          tension: normalizeTension(item.tension),
          location: s(item.location),
          timeLabel: s(item.timeLabel),
          characterNames: stringList(item.characterNames).slice(0, 8),
          povCharacterName: s(item.povCharacterName),
        }
      })
      .filter((item) => item.title)

  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  let resultItems = normalizeItems(rawItems)
  let critiqueNotes: string | undefined

  // Self-critique loop: run on drafts with 8+ items
  if (resultItems.length >= 8) {
    const critiqued = await critiqueAndFixOutlineByAi(prompt, parsed)
    if (Array.isArray(critiqued.items) && critiqued.items.length >= resultItems.length * 0.5) {
      resultItems = normalizeItems(critiqued.items)
      critiqueNotes = s(critiqued.critiqueNotes) || undefined
    }
  }

  return {
    title: s(parsed.title),
    summary: s(parsed.summary),
    storylines: Array.isArray(parsed.storylines)
      ? parsed.storylines
          .map((item: JsonRecord) => {
            const rawType = s(item.type) as OutlineStorylineType
            return {
              name: s(item.name),
              type: storylineTypeSet.has(rawType) ? rawType : 'custom',
              description: s(item.description),
              colorHint: s(item.colorHint),
            }
          })
          .filter((item) => item.name)
      : [],
    characterCast: parseOutlineCharacterCast(parsed.characterCast),
    relationCast: parseOutlineRelationCast(parsed.relationCast),
    items: resultItems,
    critiqueNotes,
  }
}

type OutlineAiCharacterCastRow = {
  name: string
  role: string
  voice: string
  personality: string
  desire: string
  fear: string
  secret: string
  arc: string
}

type OutlineAiRelationCastRow = {
  fromName: string
  toName: string
  relationType: string
  note: string
  dynamic: string
}

function parseOutlineCharacterCast(raw: unknown): OutlineAiCharacterCastRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: JsonRecord) => ({
      name: s(item.name),
      role: s(item.role),
      voice: s(item.voice),
      personality: s(item.personality),
      desire: s(item.desire),
      fear: s(item.fear),
      secret: s(item.secret),
      arc: s(item.arc),
    }))
    .filter((item) => item.name)
}

function parseOutlineRelationCast(raw: unknown): OutlineAiRelationCastRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: JsonRecord) => ({
      fromName: s(item.fromName),
      toName: s(item.toName),
      relationType: s(item.relationType),
      note: [s(item.note), s(item.dynamic)].filter(Boolean).join('；'),
      dynamic: s(item.dynamic),
    }))
    .filter((item) => item.fromName && item.toName && item.relationType)
}

function buildOutlineDesignSelectedOptionContext(input: {
  novelTitle: string
  novelSummary?: string
  history: Array<{ label: string; prompt: string; answer: string }>
  selectedOption: {
    title: string
    premise: string
    structure: string
    highlights: string[]
    endingTone: string
    beats: string[]
  }
  optionRefinement?: string
  optionRevisionHistory?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
}): string {
  return [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `作者选中的方案：${stableStringify({
      title: s(input.selectedOption.title),
      premise: s(input.selectedOption.premise),
      structure: s(input.selectedOption.structure),
      narrativeShape: s((input.selectedOption as OutlineDesignOption).narrativeShape),
      coreQuestion: s((input.selectedOption as OutlineDesignOption).coreQuestion),
      forbiddenCliche: s((input.selectedOption as OutlineDesignOption).forbiddenCliche),
      highlights: input.selectedOption.highlights ?? [],
      endingTone: s(input.selectedOption.endingTone),
      beats: input.selectedOption.beats ?? [],
    })}`,
    s(input.optionRefinement) ? `作者对该方案的补充调整意见：${s(input.optionRefinement)}` : '',
    input.optionRevisionHistory && input.optionRevisionHistory.length > 0
      ? `方案调整历史：${stableStringify(input.optionRevisionHistory)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function expandOutlineSkeletonByAi(
  payload: WorkspaceSnapshotPayload,
  input: Parameters<typeof expandOutlineDesignByAi>[1],
): Promise<{
  title: string
  summary: string
  storylines: Array<{
    name: string
    type: OutlineStorylineType
    description: string
    colorHint: string
  }>
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter'
    goal: string
    storylineNames: string[]
  }>
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请只生成卷/幕/章骨架，不要生成场景；章节 goal 须考虑核心角色动机与关系走向。',
  ].filter(Boolean).join('\n\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_SKELETON_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  const storylineTypeSet = new Set<OutlineStorylineType>(['main', 'subplot', 'character', 'romance', 'antagonist', 'world', 'custom'])
  const skeletonLevels = new Set(['volume', 'act', 'chapter'])

  return {
    title: s(parsed.title),
    summary: s(parsed.summary),
    storylines: Array.isArray(parsed.storylines)
      ? parsed.storylines
          .map((item: JsonRecord) => {
            const rawType = s(item.type) as OutlineStorylineType
            return {
              name: s(item.name),
              type: storylineTypeSet.has(rawType) ? rawType : 'custom',
              description: s(item.description),
              colorHint: s(item.colorHint),
            }
          })
          .filter((item) => item.name)
      : [],
    items: Array.isArray(parsed.items)
      ? parsed.items
          .map((item: JsonRecord, index: number) => {
            const rawLevel = s(item.level)
            const level = (skeletonLevels.has(rawLevel) ? rawLevel : 'chapter') as 'volume' | 'act' | 'chapter'
            return {
              tempId: s(item.tempId) || `sk-${index + 1}`,
              parentTempId: s(item.parentTempId),
              title: s(item.title) || `节点 ${index + 1}`,
              summary: s(item.summary),
              level,
              goal: s(item.goal),
              storylineNames: stringList(item.storylineNames),
            }
          })
          .filter((item) => item.title)
      : [],
  }
}

export async function expandOutlineScenesForSkeletonByAi(
  payload: WorkspaceSnapshotPayload,
  input: Parameters<typeof expandOutlineDesignByAi>[1] & {
    skeletonItems: Array<{
      tempId: string
      parentTempId: string
      title: string
      summary: string
      level: 'volume' | 'act' | 'chapter'
      goal: string
      storylineNames: string[]
    }>
    characterCast?: Array<{ name: string; role: string }>
  },
): Promise<{
  items: Awaited<ReturnType<typeof expandOutlineDesignByAi>>['items']
  characterCast: OutlineAiCharacterCastRow[]
  relationCast: OutlineAiRelationCastRow[]
  critiqueNotes?: string
}> {
  const chapterNodes = input.skeletonItems.filter((row) => row.level === 'chapter')
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已确认章节骨架：${stableStringify(chapterNodes)}`,
    input.characterCast && input.characterCast.length > 0
      ? `角色表：${stableStringify(input.characterCast)}`
      : '',
    '请只为上述 chapter 节点补充 scene 子节点；每场须体现出场人物的性格差异与关系张力。',
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
  ].filter(Boolean).join('\n\n')

  const parsed = await callAiJson(prompt, OUTLINE_DESIGN_FILL_SCENES_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  const levelSet = new Set(['scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }

  const sceneItems = Array.isArray(parsed.items)
    ? parsed.items
        .map((item: JsonRecord, index: number) => {
          const rawLevel = s(item.level)
          const rawPlotStage = s(item.plotStage)
          return {
            tempId: s(item.tempId) || `sc-${index + 1}`,
            parentTempId: s(item.parentTempId),
            title: s(item.title) || `场景 ${index + 1}`,
            summary: s(item.summary),
            emotionalTurn: s(item.emotionalTurn),
            proseHint: s(item.proseHint),
            level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'scene',
            goal: s(item.goal),
            conflict: s(item.conflict),
            twist: s(item.twist),
            result: s(item.result),
            suspense: s(item.suspense),
            plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
            storylineNames: stringList(item.storylineNames),
            tension: normalizeTension(item.tension),
            location: s(item.location),
            timeLabel: s(item.timeLabel),
            characterNames: stringList(item.characterNames).slice(0, 8),
            povCharacterName: s(item.povCharacterName),
          }
        })
        .filter((item) => item.title && item.parentTempId)
    : []

  let resultItems = sceneItems
  let critiqueNotes: string | undefined

  // Self-critique loop: run on drafts with 8+ items
  if (resultItems.length >= 8) {
    const critiqued = await critiqueAndFixOutlineByAi(prompt, parsed)
    if (Array.isArray(critiqued.items) && critiqued.items.length >= resultItems.length * 0.5) {
      resultItems = critiqued.items
        .map((item: JsonRecord, index: number) => {
          const rawLevel = s(item.level)
          const rawPlotStage = s(item.plotStage)
          return {
            tempId: s(item.tempId) || `sc-${index + 1}`,
            parentTempId: s(item.parentTempId),
            title: s(item.title) || `场景 ${index + 1}`,
            summary: s(item.summary),
            emotionalTurn: s(item.emotionalTurn),
            proseHint: s(item.proseHint),
            level: 'scene' as const,
            goal: s(item.goal),
            conflict: s(item.conflict),
            twist: s(item.twist),
            result: s(item.result),
            suspense: s(item.suspense),
            plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
            storylineNames: stringList(item.storylineNames),
            tension: normalizeTension(item.tension),
            location: s(item.location),
            timeLabel: s(item.timeLabel),
            characterNames: stringList(item.characterNames).slice(0, 8),
            povCharacterName: s(item.povCharacterName),
          }
        })
        .filter((item: { title: string; parentTempId: string }) => item.title && item.parentTempId)
      critiqueNotes = s(critiqued.critiqueNotes) || undefined
    }
  }

  return {
    items: resultItems,
    characterCast: parseOutlineCharacterCast(parsed.characterCast),
    relationCast: parseOutlineRelationCast(parsed.relationCast),
    critiqueNotes,
  }
}

function parseOutlineDesignItemRows(parsed: JsonRecord): Array<{
  tempId: string
  parentTempId: string
  title: string
  summary: string
  level: 'volume' | 'act' | 'chapter' | 'scene'
  goal: string
  conflict: string
  twist: string
  result: string
  suspense: string
  plotStage: 'idea' | 'drafted' | 'written' | 'resolved'
  storylineNames: string[]
  tension: 1 | 2 | 3 | 4 | 5
  location: string
  timeLabel: string
  characterNames: string[]
  povCharacterName: string
  emotionalTurn: string
  proseHint: string
}> {
  const levelSet = new Set(['volume', 'act', 'chapter', 'scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }
  if (!Array.isArray(parsed.items)) return []
  return parsed.items
    .map((item: JsonRecord, index: number) => {
      const rawLevel = s(item.level)
      const rawPlotStage = s(item.plotStage)
      return {
        tempId: s(item.tempId) || `node-${index + 1}`,
        parentTempId: s(item.parentTempId),
        title: s(item.title) || `节点 ${index + 1}`,
        summary: s(item.summary),
        emotionalTurn: s(item.emotionalTurn),
        proseHint: s(item.proseHint),
        level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'volume' | 'act' | 'chapter' | 'scene',
        goal: s(item.goal),
        conflict: s(item.conflict),
        twist: s(item.twist),
        result: s(item.result),
        suspense: s(item.suspense),
        plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
        storylineNames: stringList(item.storylineNames),
        tension: normalizeTension(item.tension),
        location: s(item.location),
        timeLabel: s(item.timeLabel),
        characterNames: stringList(item.characterNames).slice(0, 8),
        povCharacterName: s(item.povCharacterName),
      }
    })
    .filter((item) => item.title)
}

export async function expandOutlineFromExistingByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novel: {
      title: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
    anchorOutlineId: string
    expandNote?: string
    expandPreset?: 'auto' | 'next_chapters' | 'split_scenes' | 'subplot'
  },
): Promise<{
  brief: string
  items: ReturnType<typeof parseOutlineDesignItemRows>
}> {
  const presetHint =
    input.expandPreset === 'next_chapters'
      ? '优先在锚点后新增若干 chapter 节点（每条含简要 goal），必要时再拆 scene。'
      : input.expandPreset === 'split_scenes'
        ? '若锚点是 chapter，为其下拆 2 到 4 个 scene；若已是 scene，可在同级补充衔接场。'
        : input.expandPreset === 'subplot'
          ? '围绕锚点补一条支线走向（chapter/scene），与主线形成交叉但勿抢戏。'
          : '根据作者说明与现有缺口自行判断扩展 chapter 或 scene。'

  const context = buildOutlineAiContextPack(payload, input.novel, {
    anchorOutlineId: input.anchorOutlineId,
  })

  const prompt = [
    context.text,
    `扩展锚点节点 id：${s(input.anchorOutlineId)}`,
    `扩展要求：${s(input.expandNote) || '沿现有大纲自然往后推进'}`,
    presetHint,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请只输出新增节点 JSON。',
  ].join('\n\n')

  const parsed = await callAiJson(prompt, OUTLINE_EXPAND_EXISTING_SYSTEM_PROMPT, OUTLINE_DESIGN_JSON_TEMPERATURE)
  return {
    brief: s(parsed.brief),
    items: parseOutlineDesignItemRows(parsed),
  }
}
