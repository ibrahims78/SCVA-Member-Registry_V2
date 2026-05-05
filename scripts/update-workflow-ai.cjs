const fs = require('fs');
const path = require('path');

const wfPath = path.resolve(__dirname, '../docs/form_by_n8n/workflow/scva-member-workflow.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf-8'));

const newJsCode = [
  "// ══════════════════════════════════════════════════",
  "//  AI Analysis Node v2.4 — مُحقَّن من إعدادات SCVA",
  "//  المزود والمفتاح مُضمَّنان تلقائياً عند تحميل ملف Workflow",
  "// ══════════════════════════════════════════════════",
  "",
  "const d = $input.first().json;",
  "let aiAnalysis = '';",
  "let aiWelcome  = '';",
  "",
  "// ── مُحقَّن تلقائياً من إعدادات التطبيق عند تحميل الـ Workflow ──",
  "const AI_PROVIDER = '__SCVA_AI_PROVIDER__'; // openai | gemini",
  "const AI_API_KEY  = '__SCVA_AI_KEY__';",
  "",
  "try {",
  "  const hasKey = AI_API_KEY && AI_API_KEY !== '__SCVA_AI_KEY__' && AI_API_KEY.length > 10;",
  "  const canFetch = typeof fetch === 'function';",
  "",
  "  if (hasKey && canFetch) {",
  "",
  "    const callAI = async (prompt, maxTokens) => {",
  "      if (AI_PROVIDER === 'gemini') {",
  "        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${AI_API_KEY}`;",
  "        const resp = await fetch(url, {",
  "          method: 'POST',",
  "          headers: { 'Content-Type': 'application/json' },",
  "          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })",
  "        });",
  "        const json = await resp.json();",
  "        return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';",
  "      } else {",
  "        // OpenAI (default)",
  "        const resp = await fetch('https://api.openai.com/v1/chat/completions', {",
  "          method: 'POST',",
  "          headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },",
  "          body: JSON.stringify({",
  "            model: 'gpt-4o-mini',",
  "            messages: [{ role: 'user', content: prompt }],",
  "            max_tokens: maxTokens,",
  "            temperature: 0.7",
  "          })",
  "        });",
  "        const json = await resp.json();",
  "        return json.choices?.[0]?.message?.content?.trim() || '';",
  "      }",
  "    };",
  "",
  "    // ── فقرة تحليلية للمسؤول ─────────────────────────────",
  "    const adminPrompt = `أنت مساعد إداري للرابطة السورية لأمراض وجراحة القلب (SCVA).",
  "تلقّت الرابطة طلب عضوية جديدة بالبيانات التالية:",
  "- الاسم: ${d.fullName || '—'} (${d.englishName || '—'})",
  "- التخصص: ${d.specialty || 'غير محدد'}",
  "- نوع العضوية: ${d.membershipType || 'غير محدد'}",
  "- المدينة: ${d.city || 'غير محددة'}",
  "- ESC ID: ${d.escId || 'غير موجود'}",
  "- بريد إلكتروني: ${d.email ? 'موجود ✓' : 'غير موجود ✗'}",
  "- هاتف: ${d.phone ? 'موجود ✓' : 'غير موجود ✗'}",
  "",
  "اكتب فقرة احترافية موجزة (3-4 جمل) تتضمن تقييم الطلب وأي بيانات ناقصة وتوصية بالإجراء القادم. اكتب مباشرة دون عنوان.`;",
  "",
  "    aiAnalysis = await callAI(adminPrompt, 300);",
  "",
  "    // ── رسالة ترحيب للعضو ────────────────────────────────",
  "    const isAr = d.language !== 'en';",
  "    const memberPrompt = isAr",
  "      ? `اكتب جملتين أو ثلاث جمل ترحيبية دافئة واحترافية للدكتور/ة ${d.fullName || ''} المتقدم لعضوية \"${d.membershipType || 'العضوية'}\" في الرابطة السورية لأمراض وجراحة القلب. اشكره على تقديم طلبه واذكر أن المراجعة ستستغرق وقتاً قصيراً.`",
  "      : `Write 2-3 warm and professional welcome sentences to Dr. ${d.englishName || ''} who applied for \"${d.membershipType || 'membership'}\" at the Syrian Cardiovascular Association (SCVA). Thank them and mention their application is under review.`;",
  "",
  "    aiWelcome = await callAI(memberPrompt, 150);",
  "  }",
  "} catch (_) {",
  "  aiAnalysis = '';",
  "  aiWelcome  = '';",
  "}",
  "",
  "return [{ json: { ...d, aiAnalysis, aiWelcome } }];"
].join('\n');

let found = false;
for (const node of wf.nodes) {
  if (node.id === 'ai-analysis') {
    node.parameters.jsCode = newJsCode;
    found = true;
    console.log('✅ Updated ai-analysis node');
    break;
  }
}

if (!found) {
  console.error('❌ ai-analysis node not found!');
  process.exit(1);
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf-8');
console.log('✅ Workflow JSON saved successfully');
