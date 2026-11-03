// Cloudflare Worker：/api/analyze
// 环境变量（通过 wrangler secret 或 .dev.vars 配置）：
//   DASHSCOPE_API_KEY   阿里云百炼 API Key（必填，机密）
//   VISION_MODEL        多模态模型名，默认 qwen3.8-max（可改）
//   ALLOWED_ORIGINS     允许跨域的前端地址，逗号分隔，如 https://xxx.github.io

const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 约 2MB
const DIMENSIONS = ["清冷", "灵动", "书卷", "锋芒", "温润"];
const ARCHETYPE_IDS = [
  "court_painter", "archive_keeper", "wandering_swordsman", "mountain_hermit", "academy_scholar",
  "tea_house_mistress", "palace_musician", "river_boatman", "frontier_general", "imperial_poet",
  "temple_maiden", "garden_lady", "spring_dancer", "night_astronomer", "tea_master",
  "royal_bodyguard", "poem_girl_village", "sea_merchant", "bookstore_owner", "lantern_maker",
];

const SYSTEM_PROMPT = `你是一位古风文化与美学的娱乐内容创作者。用户会上传一张人像照片，你需要根据照片中可见的气质、神态、五官风格，为其生成一个"前世"古风身份的娱乐性测评。

严格遵守：
1. 只做风格联想，不识别身份，不提及真实历史人物姓名。
2. 所有描述必须正向、温和，不使用"丑""难看""低分"等打击性表述。
3. 若照片中没有清晰的人脸，仍需输出 JSON，但 observations 中说明"未检测到清晰正脸"，dimensions 各项取 60。
4. 只输出一个 JSON 对象，不要任何解释或 Markdown 代码块。

JSON 字段：
{
  "dynasty": "朝代，如：唐",
  "title": "身份称号，4-8字，如：藏书阁女官",
  "verdict": "判词，8-14字的四字或七字句式，如：执笔为刃，不负此生",
  "dimensions": {"清冷": 0-100整数, "灵动": 0-100整数, "书卷": 0-100整数, "锋芒": 0-100整数, "温润": 0-100整数},
  "observations": ["基于照片的面部/气质观察1，15-30字", "观察2"],
  "story": "前世小传，约120-160字，结构为出身、性格、结局一句，文风雅致",
  "style_tips": ["今生古风发饰或配色建议，15字内", "服色建议", "妆容建议"]
}
身份称号可参考这些原型方向：宫廷画师、藏书阁女官、江湖游侠、山中隐士、书院才子、茶楼掌柜、梨园乐伎、江畔渔人、边塞将军、长安诗客、古寺香客、园林才女、春日舞姬、夜观星象者、茶道师、宫廷侍卫、田园诗人、海港商女、书肆老板、灯市匠人。`;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  // 本地开发默认允许 localhost
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// 从模型返回文本中提取 JSON（容错处理 Markdown 代码块）
function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validate(d) {
  if (!d || typeof d.title !== "string" || typeof d.dynasty !== "string") throw new Error("missing fields");
  if (typeof d.verdict !== "string" || typeof d.story !== "string" || !d.dimensions) throw new Error("missing fields");
  return d;
}

async function analyzeWithModel(image, env) {
  const model = env.VISION_MODEL || "qwen3.8-max";
  const resp = await fetch(DASHSCOPE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: "请根据这张照片，按要求输出前世测评 JSON。" },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`model http ${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  return validate(extractJson(content));
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "ancient-persona" }, 200, headers);
    }
    if (url.pathname !== "/api/analyze" || request.method !== "POST") {
      return json({ error: "not found" }, 404, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400, headers);
    }
    const image = body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return json({ error: "image must be a data URL" }, 400, headers);
    }
    if (image.length * 0.75 > MAX_IMAGE_BYTES) {
      return json({ error: "image too large" }, 413, headers);
    }
    if (!env.DASHSCOPE_API_KEY) {
      return json({ error: "server not configured" }, 500, headers);
    }

    try {
      const result = await analyzeWithModel(image, env);
      return json(result, 200, headers);
    } catch (err) {
      console.error("analyze failed:", err.message);
      return json({ error: "analysis failed" }, 502, headers);
    }
  },
};
