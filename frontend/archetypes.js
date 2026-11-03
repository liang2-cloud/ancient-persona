// 原创身份模板（不使用真实历史人物），供模型选择与本地兜底使用
const ARCHETYPES = [
  { id: "court_painter", dynasty: "宋", title: "翰林画师", tags: "丹青入神、观物细微", color: "青绿", accessory: "青玉簪" },
  { id: "archive_keeper", dynasty: "唐", title: "藏书阁女官", tags: "执笔不让须眉", color: "月白", accessory: "木兰簪" },
  { id: "wandering_swordsman", dynasty: "明", title: "江湖游侠", tags: "快意恩仇、心有山河", color: "玄青", accessory: "银丝发带" },
  { id: "mountain_hermit", dynasty: "魏晋", title: "山中隐士", tags: "清风明月、不问俗事", color: "竹青", accessory: "木质发簪" },
  { id: "academy_scholar", dynasty: "宋", title: "书院才子", tags: "谈笑有鸿儒、往来无白丁", color: "藏青", accessory: "玉冠" },
  { id: "tea_house_mistress", dynasty: "清", title: "茶楼掌柜", tags: "八面玲珑、心明如镜", color: "藕荷", accessory: "珍珠步摇" },
  { id: "palace_musician", dynasty: "唐", title: "梨园乐伎", tags: "一曲动四座、眉眼含韵", color: "胭脂红", accessory: "金累丝钗" },
  { id: "river_boatman", dynasty: "汉", title: "江畔渔人", tags: "泛舟江湖、随遇而安", color: "靛蓝", accessory: "竹笠" },
  { id: "frontier_general", dynasty: "汉", title: "边塞将军", tags: "锋芒在骨、心怀家国", color: "玄铁灰", accessory: "束发银冠" },
  { id: "imperial_poet", dynasty: "唐", title: "长安诗客", tags: "一句成诗、举杯邀月", color: "朱砂", accessory: "白玉簪" },
  { id: "temple_maiden", dynasty: "明", title: "古寺香客", tags: "心静如水、慈悲自知", color: "素白", accessory: "檀木珠串" },
  { id: "garden_lady", dynasty: "宋", title: "园林才女", tags: "诗画双绝、雅致天成", color: "雨过天青", accessory: "玉兰花簪" },
  { id: "spring_dancer", dynasty: "唐", title: "春日舞姬", tags: "轻盈如燕、明媚张扬", color: "石榴红", accessory: "流苏耳坠" },
  { id: "night_astronomer", dynasty: "元", title: "夜观星象者", tags: "仰望星空、洞悉玄机", color: "墨蓝", accessory: "星纹玉坠" },
  { id: "tea_master", dynasty: "明", title: "茶道师", tags: "一盏清茶、静水流深", color: "秋香色", accessory: "竹节簪" },
  { id: "royal_bodyguard", dynasty: "清", title: "宫廷侍卫", tags: "沉稳可靠、护人周全", color: "深褐", accessory: "乌木发冠" },
  { id: "poem_girl_village", dynasty: "汉", title: "田园诗人", tags: "阡陌之间、诗意自生", color: "麦秆黄", accessory: "野花发饰" },
  { id: "sea_merchant", dynasty: "宋", title: "海港商女", tags: "运筹帷幄、笑纳四方", color: "海天蓝", accessory: "螺钿发梳" },
  { id: "bookstore_owner", dynasty: "明", title: "书肆老板", tags: "博闻强识、温润有礼", color: "琥珀", accessory: "玳瑁簪" },
  { id: "lantern_maker", dynasty: "宋", title: "灯市匠人", tags: "巧思独运、暖意满怀", color: "暖橘", accessory: "铜质发钗" },
];

const DIMENSION_NAMES = ["清冷", "灵动", "书卷", "锋芒", "温润"];
