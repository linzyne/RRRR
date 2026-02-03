
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey || apiKey === '여기에_GEMINI_API_KEY_입력' || !apiKey) {
  console.error("[Gemini] API Key is missing or invalid in .env.local (VITE_GEMINI_API_KEY)");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * 이미지를 URL로부터 가져와서 Base64로 변환하는 헬퍼 함수
 * CORS 우회를 위해 5단계 시도를 수행하여 "어떻게 해서든" 이미지를 가져옵니다.
 */
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string, data: string } | null> {
  const attempts = [
    { name: 'Direct', url: url },
    { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(url)}` },
    { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
    { name: 'Weserv', url: `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}` },
    { name: 'Cloudflare-Worker-Proxy (Fallback)', url: `https://cors-anywhere.herokuapp.com/${url}` } // 공용 프록시 최후의 수단
  ];

  for (const attempt of attempts) {
    try {
      console.log(`[Gemini] Attempting image load (${attempt.name})...`);
      const resp = await fetch(attempt.url, {
        headers: { 'Accept': 'image/*' }
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const blob = await resp.blob();

      // MIME 타입이 이미지가 아닐 경우 강제 보정 (프록시 응답 대응)
      let mimeType = blob.type;
      if (!mimeType.startsWith('image/')) {
        console.warn(`[Gemini] Non-image MIME type detected: ${mimeType}. Forcing image/jpeg.`);
        mimeType = 'image/jpeg';
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log(`[Gemini] ✅ Image load success via ${attempt.name}`);
      return {
        mimeType: mimeType,
        data: base64.split(',')[1]
      };
    } catch (err) {
      console.warn(`[Gemini] ❌ ${attempt.name} load failed:`, err);
    }
  }

  console.error("[Gemini] 🚨 All image loading attempts failed. CORS or Network issue persists.");
  return null;
}

export const extractOrderDetails = async (images: string | string[]) => {
  const imageArray = typeof images === 'string' ? images.split(',').filter(img => img.trim() !== '') : images;

  console.log(`[Gemini] Starting extraction for ${imageArray.length} images...`);

  const imageParts = await Promise.all(imageArray.map(async (img) => {
    if (img.startsWith('http')) {
      const result = await fetchImageAsBase64(img);
      return result ? { inlineData: result } : null;
    } else {
      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.split(',')[1] || img
        }
      };
    }
  }));

  const validParts = imageParts.filter(part => part !== null) as any[];

  if (validParts.length === 0) {
    const reason = imageArray.length === 0 ? "업로드된 이미지가 없음" : "이미지 로딩 서버 차단 (CORS 문제)";
    console.error(`[Gemini] No valid image parts. Reason: ${reason}`);
    return { ordererName: reason, orderNumber: reason, address: reason };
  }

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      당신은 한국 온라인 쇼핑몰(쿠팡, 네이버 쇼핑, 배달의민족, 11번가, G마켓 등)의 스크린샷에서 정보를 추출하는 전문가입니다.
      제공된 이미지(들)에서 다음 정보를 찾아 한국어로 정확하게 JSON 형식으로 응답하세요:

      1. ordererName (주문자명): 
         - '주문자', '받는 분', '성함' 등에 적힌 이름. 없을 경우 빈 문자열.
      2. orderNumber (주문번호): 
         - **가장 중요한 정보입니다.** 
         - 숫자와 하이픈(-)으로 구성된 번호(예: 15100169444279, 20240101-1234567, 123-45678-90 등)를 꼼꼼히 찾으세요.
         - '주문번호:', 'Order No.', '#' 뒤에 오는 번호를 우선 추출하세요.
      3. address (배송지 주소): 
         - '배송지', '주소', '받는 곳' 등에 적힌 도로명/지번 주소와 상세 주소를 포함하세요.

      [주의사항]
      - 여러 장의 이미지가 있다면 하나씩 꼼꼼히 분석하여 흩어져 있는 정보를 통합하세요.
      - 텍스트가 흐릿하더라도 주변 문맥을 통해 "주문번호"를 반드시 찾아내세요.
      - 반드시 지정된 JSON 프로퍼티 키를 사용하세요.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [...validParts, { text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ordererName: { type: Type.STRING },
            orderNumber: { type: Type.STRING },
            address: { type: Type.STRING }
          },
          required: ["ordererName", "orderNumber", "address"]
        }
      }
    });

    const text = result.response.text();
    console.log("[Gemini] Raw Response:", text);
    return JSON.parse(text || '{}');
  } catch (e) {
    console.error("[Gemini] Extraction failure:", e);
    return { ordererName: "추출 오류", orderNumber: "추출 오류", address: "추출 오류" };
  }
};

// verifyImage
export const verifyImage = async (base64Image: string, type: 'purchase' | 'review') => {
  const prompt = type === 'purchase'
    ? "이 이미지가 한국 쇼핑몰의 '주문 완료', '주문 상세', '결제 내역' 화면인지 확인해줘. 맞으면 {\"valid\": true}를, 틀리면 {\"valid\": false, \"reason\": \"사유\"}를 반환해."
    : "이 이미지가 쇼핑몰의 '리뷰 작성 완료', '내가 쓴 리뷰' 화면인지 확인해줘. 맞으면 {\"valid\": true}를, 틀리면 {\"valid\": false, \"reason\": \"사유\"}를 반환해.";

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } },
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["valid"]
        }
      }
    });

    return JSON.parse(result.response.text() || '{}');
  } catch (e) {
    console.error("[Gemini] Verification Error:", e);
    return { valid: false, reason: "AI 연결 확인 필요" };
  }
};
