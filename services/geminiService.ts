
import { GoogleGenAI, Type } from "@google/genai";
import { FrameType } from "../types";

export const APPLE_PHILOSOPHY_PREFIX = `
Follow the Apple Visual Philosophy:
- Minimalism: Extreme simplicity, remove unnecessary elements.
- Clean Focus: No clutter, soft backgrounds, cinematic depth of field.
- Negative Space: Create airiness and openness.
- Materials: High-end textures like frosted glass, brushed aluminum, satin fabric.
- Lighting: Soft studio lighting, volumetric light, elegant shadows.
- Atmosphere: Subtle fog, high contrast, clean color palettes (white, silver, space gray, or deep indigo).
`;

export async function generateApplePrompt(
  shotDescription: string, 
  frameType: FrameType,
  referenceImage?: string // Base64 string for visual context
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const typeDescription = frameType === FrameType.START ? "The beginning of the motion" : frameType === FrameType.END ? "The final resolution of the motion" : "A mid-point transition";
  
  const parts: any[] = [];

  // If a reference image is provided, analyze it to maintain consistency
  if (referenceImage) {
    const base64 = referenceImage.split(',')[1];
    parts.push({ inlineData: { data: base64, mimeType: 'image/png' } });
    parts.push({ text: `
      Analyze the provided reference image (which is the preceding frame in the sequence). 
      Extract its visual style tokens: lighting temperature, color grading palette, film grain, contrast level, and lens depth of field characteristics.
    `});
  }

  parts.push({ text: `
    Transform this shot description into a high-end cinematic image prompt for an AI generator. 
    
    Current Frame Type: ${typeDescription}.
    Current Shot Description: ${shotDescription}
    Style Constraint: ${APPLE_PHILOSOPHY_PREFIX}

    ${referenceImage ? `CRITICAL CONTINUITY INSTRUCTION: The new image prompt MUST ensure absolute visual continuity with the reference image analyzed above. 
    You MUST explicitly describe the lighting, colors, and atmosphere to match the reference image exactly. 
    The new prompt should describe the NEXT logical moment (or the resolution) in a way that feels like a continuous cut or flow from the reference.
    Do not change the art style.` : ''}

    Output only the final prompt string.
  `});
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: parts,
    },
  });

  return response.text || shotDescription;
}

export async function generateStoryboardImage(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from Gemini");
}

export async function generateMidFrameImage(startImageUrl: string, endImageUrl: string, shotDescription: string, progress: number): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const startBase64 = startImageUrl.split(',')[1];
  const endBase64 = endImageUrl.split(',')[1];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: startBase64, mimeType: 'image/png' } },
        { inlineData: { data: endBase64, mimeType: 'image/png' } },
        { text: `Generate a middle frame that represents a transition exactly ${Math.round(progress * 100)}% through the motion between the first image (start) and second image (end). 
        Shot Intent: ${shotDescription}. 
        Constraint: Maintain absolute visual consistency, color palette, lighting, and ${APPLE_PHILOSOPHY_PREFIX}. 
        The resulting image must bridge the gap between the two provided frames naturally.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate intermediate frame");
}

export async function editStoryboardImage(imageUrl: string, editPrompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const base64Data = imageUrl.split(',')[1];
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: 'image/png' } },
        { text: `${editPrompt}. Maintain the Apple minimalism aesthetic.` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
}

export async function animateFrameWithVeo(imageUrl: string, prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const base64Data = imageUrl.split(',')[1];

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Animate this scene naturally: ${prompt}. Subtle motion, elegant flow.`,
    image: {
      imageBytes: base64Data,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 8000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");
  
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function parseDocumentToShots(fileData: string, mimeType: string): Promise<{ description: string; visualReference: string }[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
  You are an expert Film Director Assistant. 
  Analyze the attached "Visual Director Breakdown" document (PDF or Text).
  Extract the list of shots and return them as a JSON array.
  
  For each shot found in the document, extract:
  - "description": The full visual description of the shot, action, and camera movement.
  - "visualReference": Any specific lighting, style, color, or reference mentioned. If not explicitly stated, infer a brief style note based on the context.

  Output strictly valid JSON array of objects.
  Format:
  [
    { "description": "...", "visualReference": "..." },
    ...
  ]
  Translate extracted text to Chinese if it is not already.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: fileData, mimeType: mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse document JSON", e);
    return [];
  }
}
