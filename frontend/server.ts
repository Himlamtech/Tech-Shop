import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;
const API_GATEWAY_URL = (process.env.API_GATEWAY_URL || process.env.VITE_API_GATEWAY_URL || "http://localhost:1912").replace(/\/$/, "");

const proxiedApiPrefixes = [
  "/api/auth",
  "/api/admin",
  "/api/catalog",
  "/api/cart",
  "/api/orders",
  "/api/payments",
  "/api/reviews",
  "/api/shipping",
];

// Parse JSON bodies
app.use(express.json());

app.use(async (req, res, next) => {
  const shouldProxy = proxiedApiPrefixes.some((prefix) => req.path.startsWith(prefix));
  if (!shouldProxy) {
    next();
    return;
  }

  const targetUrl = `${API_GATEWAY_URL}${req.originalUrl}`;

  try {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (!value || ["host", "content-length", "connection"].includes(key)) {
        return;
      }
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
        return;
      }
      headers.set(key, value);
    });

    const body = req.method === "GET" || req.method === "HEAD"
      ? undefined
      : req.headers["content-type"]?.includes("application/json")
        ? JSON.stringify(req.body)
        : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (["content-encoding", "transfer-encoding", "connection"].includes(key)) {
        return;
      }
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    console.error(`Proxy error for ${targetUrl}:`, error);
    res.status(502).json({
      success: false,
      error: {
        code: "BAD_GATEWAY",
        message: error?.message || "Failed to reach backend gateway.",
      },
    });
  }
});

// Initialize Gemini SDK lazily, as instructed in Guidelines (fails gracefully on missing key)
let aiClient: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-1.5-flash";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function compactProduct(product: any) {
  return `**${product.name}** (${product.category || "Tech"}, ${money(product.price)}, ${product.rating || "n/a"}/5) - ${(product.features || []).slice(0, 2).join(", ") || product.description || "balanced premium option"}`;
}

function buildProductQaMock(product: any, question: string) {
  const features = (product.features || []).slice(0, 4);
  const specs = (product.specs || []).slice(0, 4);
  const stockLine = product.stock !== undefined ? `Hiện còn khoảng **${product.stock}** sản phẩm trong kho.` : "Tồn kho cần kiểm tra lại ở bước checkout.";
  return `Mình xem nhanh **${product.name}** theo câu hỏi: "${question}".\n\n**Kết luận ngắn:** đây là lựa chọn hợp nếu bạn ưu tiên ${features.slice(0, 2).join(" và ") || "trải nghiệm cao cấp, ổn định"}. Giá hiện tại là **${money(product.price)}**, điểm đánh giá **${product.rating || "n/a"}/5** từ ${product.reviewsCount || 0} review.\n\n**Điểm mạnh đáng chú ý**\n${features.map((feature: string) => `- ${feature}`).join("\n") || "- Cấu hình cân bằng cho nhu cầu phổ thông và cao cấp."}\n\n**Thông số cần nhìn trước khi mua**\n${specs.map((spec: any) => `- ${spec.label}: ${spec.value}`).join("\n") || "- Chưa có bảng thông số chi tiết trong catalog."}\n\n**Gợi ý mua:** nếu bạn cần ${product.category || "thiết bị"} dùng hằng ngày và thích sự chỉn chu, sản phẩm này đáng shortlist. Nếu ngân sách đang căng, hãy so sánh thêm một mẫu rẻ hơn cùng danh mục để xem phần chênh có thật sự cần thiết không. ${stockLine}`;
}

function buildCompareMock(productA: any, productB: any) {
  const cheaper = Number(productA.price || 0) <= Number(productB.price || 0) ? productA : productB;
  const higherRated = Number(productA.rating || 0) >= Number(productB.rating || 0) ? productA : productB;
  return `### So sánh nhanh: ${productA.name} vs ${productB.name}\n\n| Tiêu chí | ${productA.name} | ${productB.name} |\n| :--- | :--- | :--- |\n| Giá | ${money(productA.price)} | ${money(productB.price)} |\n| Danh mục | ${productA.category || "n/a"} | ${productB.category || "n/a"} |\n| Đánh giá | ${productA.rating || "n/a"}/5 | ${productB.rating || "n/a"}/5 |\n| Điểm nổi bật | ${(productA.features || [productA.tag || "Cân bằng"])[0]} | ${(productB.features || [productB.tag || "Cân bằng"])[0]} |\n\n**Khác biệt chính**\n- **Giá trị tiền bỏ ra:** ${cheaper.name} dễ chọn hơn nếu bạn muốn kiểm soát ngân sách.\n- **Tín hiệu đánh giá:** ${higherRated.name} đang có lợi thế về điểm rating trong catalog.\n- **Nhu cầu dùng:** ${productA.name} hợp với ${productA.tag || productA.category || "nhu cầu cao cấp"}; ${productB.name} hợp với ${productB.tag || productB.category || "một nhóm nhu cầu khác"}.\n\n**AI verdict:** chọn **${higherRated.name}** nếu bạn muốn phương án ít rủi ro hơn theo rating. Chọn **${cheaper.name}** nếu ưu tiên giá và vẫn muốn giữ trải nghiệm cao cấp.`;
}

function buildChatMock(products: any[], latestMessage: string, selectedProductId?: string) {
  const catalog = Array.isArray(products) ? products : [];
  const lower = latestMessage.toLowerCase();
  const selected = catalog.find((product) => String(product.id) === String(selectedProductId));
  const scored = catalog
    .map((product) => {
      const haystack = [product.name, product.category, product.brand, product.tag, product.description, ...(product.features || [])].join(" ").toLowerCase();
      const score = lower.split(/\s+/).filter((token) => token.length > 2 && haystack.includes(token)).length + Number(product.rating || 0) / 10;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || Number(b.product.rating || 0) - Number(a.product.rating || 0));
  const picks = (scored.some((item) => item.score > 0.5) ? scored : catalog.map((product) => ({ product, score: 0 }))).slice(0, 3).map((item) => item.product);

  if (catalog.length === 0) {
    return "Catalog chưa tải xong nên mình chưa thể chọn sản phẩm cụ thể. Bạn cho mình biết ngân sách, mục đích dùng và ưu tiên như pin/hiệu năng/di động, mình sẽ lọc ngay khi dữ liệu sẵn sàng.";
  }

  const intro = selected ? `Mình đang thấy bạn mở **${selected.name}**, nên sẽ dùng nó làm mốc so sánh.\n\n` : "Mình lọc nhanh từ catalog hiện tại như một tư vấn viên mua hàng.\n\n";
  const recommendation = picks.map((product, index) => `${index + 1}. ${compactProduct(product)}`).join("\n");

  if (lower.includes("compare") || lower.includes("so sánh")) {
    return `${intro}**Shortlist nên so sánh:**\n${recommendation}\n\n**Cách chọn:** nếu bạn muốn an toàn, ưu tiên mẫu rating cao và nhiều review. Nếu bạn mua để dùng lâu, hãy so specs quan trọng nhất với workflow của bạn thay vì nhìn giá trước.`;
  }

  if (lower.includes("budget") || lower.includes("giá") || lower.includes("value") || lower.includes("rẻ")) {
    const valuePicks = [...catalog].sort((a, b) => Number(a.price || 0) - Number(b.price || 0)).slice(0, 3);
    return `${intro}**Gợi ý đáng tiền theo giá tăng dần:**\n${valuePicks.map((product, index) => `${index + 1}. ${compactProduct(product)}`).join("\n")}\n\nMẹo chọn: lấy mẫu rẻ nhất nếu nhu cầu rõ ràng; lấy mẫu rating cao hơn nếu bạn muốn ít đánh đổi hơn.`;
  }

  return `${intro}**3 lựa chọn mình sẽ shortlist:**\n${recommendation}\n\n**Gợi ý tiếp theo:** nói cho mình ngân sách, mục đích chính và điều bạn ghét nhất ở thiết bị cũ. Mình sẽ chốt 1 lựa chọn chính, 1 lựa chọn tiết kiệm, và 1 lựa chọn nâng cấp.`;
}

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. Using mock fallback mode for Gemini API calls.");
      // We will handle key being missing elegantly so the server doesn't crash, but throws descriptive mock results
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", usingRealGemini: !!process.env.GEMINI_API_KEY });
});

// Product Q&A Endpoint
app.post("/api/product-qa", async (req, res) => {
  const { product, question } = req.body;
  if (!product || !question) {
    return res.status(400).json({ error: "Missing product or question parameter" });
  }

  // Gracefully check for real API key
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    setTimeout(() => {
      res.json({ answer: buildProductQaMock(product, question) });
    }, 1200);
    return;
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `You are a friendly, highly knowledgeable tech sales consultant at Lamania. 
An customer is asking a about a specific product in our store: "${product.name}".
Use the following product specifications to answer their question exhaustively and professionally:
Name: ${product.name}
Price: $${product.price}
Category: ${product.category}
Rating: ${product.rating} / 5 (${product.reviewsCount} reviews)
Description: ${product.description}
Core Highlight features:
${product.features.map((f: string) => `- ${f}`).join("\n")}
Technical details:
${product.specs.map((s: any) => `- ${s.label}: ${s.value}`).join("\n")}

Respond in clear Markdown. Be objective, honest, enthusiastic, and target their use-case directly. Do not make up facts.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.error("Gemini Product QA Error:", error);
    res.json({ answer: buildProductQaMock(product, question) });
  }
});

// Side-by-Side Product Comparison Generator
app.post("/api/product-compare", async (req, res) => {
  const { productA, productB } = req.body;
  if (!productA || !productB) {
    return res.status(400).json({ error: "Missing productA or productB parameter" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    setTimeout(() => {
      res.json({ report: buildCompareMock(productA, productB) });
    }, 1500);
    return;
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `You are an expert tech product analyst. 
Compare the technical specs, pricing, and capabilities of the two tech products listed below. 
Generate a beautifully formatted side-by-side comparison report in Markdown.
The report MUST contain:
- A clean markdown comparison table comparing key metrics (Price, Rating, Primary Feature, Key Spec)
- A "Key Distinct Differences" breakdown listing 3-4 points of contrast
- Clear recommendation sectors: "Who should choose Product A" and "Who should choose Product B"
- A final concise AI Verdict.

Product A Info:
- Name: ${productA.name}
- Price: $${productA.price}
- Category: ${productA.category}
- Rating: ${productA.rating}
- Tagline: ${productA.tag}
- Description: ${productA.description}
- Features: ${productA.features.join(", ")}
- Specs: ${productA.specs.map((s: any) => `${s.label}: ${s.value}`).join(", ")}

Product B Info:
- Name: ${productB.name}
- Price: $${productB.price}
- Category: ${productB.category}
- Rating: ${productB.rating}
- Tagline: ${productB.tag}
- Description: ${productB.description}
- Features: ${productB.features.join(", ")}
- Specs: ${productB.specs.map((s: any) => `${s.label}: ${s.value}`).join(", ")}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Generate comparison report.",
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini Product Compare Error:", error);
    res.json({ report: buildCompareMock(productA, productB) });
  }
});

// Full-Scale AI Chatbot Assistant Endpoint
app.post("/api/chat", async (req, res) => {
  const { messages, selectedProductId, products = [] } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid messages parameter" });
  }

  // Grab the latest user message
  const userMessages = messages.filter((m: any) => m.sender === "user");
  const latestMessage = userMessages[userMessages.length - 1]?.text || "";

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    setTimeout(() => {
      res.json({ text: buildChatMock(products, latestMessage, selectedProductId) });
    }, 1200);
    return;
  }

  try {
    const ai = getGeminiClient();
    
    // Construct formatting and store catalogue guidelines
    const modelSystemInstruction = `You are the primary tech expert AI shopping assistant for AETHER Tech Shop, a premium, minimalist retailer for futuristic, extremely high-end hardware.
You are warm, intelligent, objective, and expert-level. You speak with clear, supportive enthusiasm and avoid buzzwords.
You help customers choose the ideal gadget based on their lifestyle, budget, or productivity needs.
If asked about items not in our catalog, gently redirect them to Aether alternatives or answer with technical knowledge while showcasing the Aether equivalent.

Catalog Overview of products currently in stock:
${products.map((product: any, index: number) => `${index + 1}. ${compactProduct(product)}`).join("\n") || "Catalog currently loading."}

If a specific product is currently selected and highlighted by the user (ID: ${selectedProductId || "(none)"}), make sure to lean towards showcasing it if it fits their query.
Use standard clean Markdown formatting in responses. Always keep it engaging!`;

    // Flatten history into Gemini-SDK expected message structure or simple continuous chat
    // For simplicity and extreme robustness utilizing gemini-3.5-flash:
    // Format previous conversation into a cohesive text prompt representation
    const formattedPrompt = messages.map((m: any) => `${m.sender === "user" ? "Customer" : "AI Shopping Expert"}: ${m.text}`).join("\n") + "\nAI Shopping Expert:";

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: formattedPrompt,
      config: {
        systemInstruction: modelSystemInstruction,
        temperature: 0.75,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Chat助理 Error:", error);
    res.json({ text: buildChatMock(products, latestMessage, selectedProductId) });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully operating on http://0.0.0.0:${PORT}`);
  });
}

startServer();
