
import React, { useState, useEffect, useRef } from 'react';
import { Shot, AppState, FrameType, Frame } from './types';
import { 
  generateApplePrompt, 
  generateStoryboardImage, 
  animateFrameWithVeo, 
  editStoryboardImage, 
  generateMidFrameImage,
  parseDocumentToShots 
} from './services/geminiService';
import { FrameCard } from './components/FrameCard';
import { AppleLoader } from './components/AppleLoader';

const INITIAL_SHOTS: Shot[] = [
  {
    id: '1',
    index: 1,
    description: "特写：黑暗房间中一个高科技玻璃球正发出柔和的蓝光脉冲。",
    visualReference: "苹果风格：聚焦透明感和光线折射。",
    keyframes: [
      { id: '1a', type: FrameType.START, isGenerating: false, isAnimating: false },
      { id: '1b', type: FrameType.END, isGenerating: false, isAnimating: false }
    ]
  },
  {
    id: '2',
    index: 2,
    description: "全景：极简主义工作室，只有一张薄金属桌，大窗外是雾气缭绕的森林。",
    visualReference: "极致留白，大气雾影，拉丝金属质感。",
    keyframes: [
      { id: '2a', type: FrameType.START, isGenerating: false, isAnimating: false },
      { id: '2b', type: FrameType.END, isGenerating: false, isAnimating: false }
    ]
  }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    shots: INITIAL_SHOTS,
    isGlobalLoading: false,
    hasApiKey: false,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setState(prev => ({ ...prev, hasApiKey: hasKey }));
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setState(prev => ({ ...prev, hasApiKey: true }));
  };

  const updateFrame = (shotId: string, frameId: string, updates: Partial<Frame>) => {
    setState(prev => ({
      ...prev,
      shots: prev.shots.map(s => {
        if (s.id !== shotId) return s;
        return {
          ...s,
          keyframes: s.keyframes.map(f => f.id === frameId ? { ...f, ...updates } : f)
        };
      })
    }));
  };

  // Upgraded generation with visual context continuity
  const generateFrames = async (shotId: string) => {
    const shotIndex = state.shots.findIndex(s => s.id === shotId);
    if (shotIndex === -1) return;
    
    const shot = state.shots[shotIndex];
    
    // 1. Get visual context from PREVIOUS shot (if exists) for Inter-shot continuity
    let prevEndImageUrl: string | undefined = undefined;
    if (shotIndex > 0) {
        const prevShot = state.shots[shotIndex - 1];
        const prevEndFrame = prevShot.keyframes.find(f => f.type === FrameType.END);
        prevEndImageUrl = prevEndFrame?.imageUrl;
    }

    const startFrame = shot.keyframes.find(f => f.type === FrameType.START);
    const endFrame = shot.keyframes.find(f => f.type === FrameType.END);

    let currentStartImageUrl = startFrame?.imageUrl;

    // 2. Generate START Frame (Bridging from previous shot)
    if (startFrame) {
        updateFrame(shotId, startFrame.id, { isGenerating: true });
        try {
            // Pass previous shot's end image as reference
            const prompt = await generateApplePrompt(shot.description, FrameType.START, prevEndImageUrl);
            const imageUrl = await generateStoryboardImage(prompt);
            
            // Update local variable for next step
            currentStartImageUrl = imageUrl;
            
            updateFrame(shotId, startFrame.id, { imageUrl, prompt, isGenerating: false });
        } catch (error) {
            console.error("Start frame failed", error);
            updateFrame(shotId, startFrame.id, { isGenerating: false });
        }
    }

    // 3. Generate END Frame (Bridging from current start frame)
    if (endFrame) {
        updateFrame(shotId, endFrame.id, { isGenerating: true });
        try {
            // Pass current shot's start image as reference (Intra-shot continuity)
            const prompt = await generateApplePrompt(shot.description, FrameType.END, currentStartImageUrl);
            const imageUrl = await generateStoryboardImage(prompt);
            
            updateFrame(shotId, endFrame.id, { imageUrl, prompt, isGenerating: false });
        } catch (error) {
            console.error("End frame failed", error);
            updateFrame(shotId, endFrame.id, { isGenerating: false });
        }
    }
  };

  const handleGenerateTransitions = async (shotId: string) => {
    const shot = state.shots.find(s => s.id === shotId);
    if (!shot) return;

    const startFrame = shot.keyframes.find(f => f.type === FrameType.START);
    const endFrame = shot.keyframes.find(f => f.type === FrameType.END);

    if (!startFrame?.imageUrl || !endFrame?.imageUrl) {
      alert("请先生成首帧和尾帧。");
      return;
    }

    // Prepare 2 MID frames
    const midFrame1Id = `mid-1-${Date.now()}`;
    const midFrame2Id = `mid-2-${Date.now()}`;

    const newMidFrames: Frame[] = [
      { id: midFrame1Id, type: FrameType.MID, isGenerating: true, isAnimating: false },
      { id: midFrame2Id, type: FrameType.MID, isGenerating: true, isAnimating: false }
    ];

    // Add them to the shot keyframes
    setState(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.id === shotId ? {
        ...s,
        keyframes: [
          s.keyframes[0], // Start
          ...newMidFrames,
          s.keyframes[s.keyframes.length - 1] // End
        ]
      } : s)
    }));

    try {
      // Generate Frame 1 (33% progress)
      const img1 = await generateMidFrameImage(startFrame.imageUrl, endFrame.imageUrl, shot.description, 0.33);
      updateFrame(shotId, midFrame1Id, { imageUrl: img1, prompt: "Transition frame 1", isGenerating: false });

      // Generate Frame 2 (66% progress)
      const img2 = await generateMidFrameImage(startFrame.imageUrl, endFrame.imageUrl, shot.description, 0.66);
      updateFrame(shotId, midFrame2Id, { imageUrl: img2, prompt: "Transition frame 2", isGenerating: false });
    } catch (error) {
      console.error("生成中间帧失败", error);
      updateFrame(shotId, midFrame1Id, { isGenerating: false });
      updateFrame(shotId, midFrame2Id, { isGenerating: false });
    }
  };

  const handleAnimate = async (shotId: string, frameId: string) => {
    const shot = state.shots.find(s => s.id === shotId);
    const frame = shot?.keyframes.find(f => f.id === frameId);
    if (!frame?.imageUrl || !frame.prompt) return;

    updateFrame(shotId, frameId, { isAnimating: true });
    try {
      const videoUrl = await animateFrameWithVeo(frame.imageUrl, frame.prompt);
      updateFrame(shotId, frameId, { videoUrl, isAnimating: false });
    } catch (error) {
      console.error("动画生成失败", error);
      updateFrame(shotId, frameId, { isAnimating: false });
      if (String(error).includes("Requested entity was not found")) {
        alert("请重新选择 API 密钥（Veo 需要付费项目密钥）");
      }
    }
  };

  const handleEdit = async (shotId: string, frameId: string, editPrompt: string) => {
    const shot = state.shots.find(s => s.id === shotId);
    const frame = shot?.keyframes.find(f => f.id === frameId);
    if (!frame?.imageUrl) return;

    updateFrame(shotId, frameId, { isGenerating: true });
    try {
      const newImageUrl = await editStoryboardImage(frame.imageUrl, editPrompt);
      updateFrame(shotId, frameId, { imageUrl: newImageUrl, isGenerating: false });
    } catch (error) {
      console.error("编辑失败", error);
      updateFrame(shotId, frameId, { isGenerating: false });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState(prev => ({ ...prev, isGlobalLoading: true }));

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      // Get base64 data (remove data URL prefix)
      const base64Data = result.split(',')[1];
      const mimeType = file.type;

      try {
        const parsedShots = await parseDocumentToShots(base64Data, mimeType);
        
        if (parsedShots && parsedShots.length > 0) {
          const newShots: Shot[] = parsedShots.map((s, idx) => {
             const shotId = `imported-${Date.now()}-${idx}`;
             return {
               id: shotId,
               index: state.shots.length + idx + 1,
               description: s.description,
               visualReference: s.visualReference || "智能推断：符合整体影片调性",
               keyframes: [
                 { id: `${shotId}a`, type: FrameType.START, isGenerating: false, isAnimating: false },
                 { id: `${shotId}b`, type: FrameType.END, isGenerating: false, isAnimating: false }
               ]
             };
          });

          setState(prev => ({
            ...prev,
            shots: [...prev.shots, ...newShots],
            isGlobalLoading: false
          }));
        } else {
          alert("无法从文档中提取有效的分镜数据。");
          setState(prev => ({ ...prev, isGlobalLoading: false }));
        }
      } catch (error) {
        console.error("解析文档失败", error);
        alert("解析文档失败，请重试。");
        setState(prev => ({ ...prev, isGlobalLoading: false }));
      }
    };
    reader.readAsDataURL(file);
    // Reset input value to allow selecting same file again
    event.target.value = '';
  };

  const addShot = () => {
    const newId = String(Date.now());
    const newShot: Shot = {
      id: newId,
      index: state.shots.length + 1,
      description: "描述新的电影镜头...",
      visualReference: "苹果哲学：极简与优雅。",
      keyframes: [
        { id: `${newId}a`, type: FrameType.START, isGenerating: false, isAnimating: false },
        { id: `${newId}b`, type: FrameType.END, isGenerating: false, isAnimating: false }
      ]
    };
    setState(prev => ({ ...prev, shots: [...prev.shots, newShot] }));
  };

  if (!state.hasApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center apple-gradient p-6 text-center">
        <div className="max-w-md w-full glass p-10 rounded-3xl shadow-2xl space-y-8">
          <div className="w-20 h-20 bg-black rounded-3xl mx-auto flex items-center justify-center text-white text-3xl font-bold">A</div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">苹果风格分镜视觉概念师</h1>
            <p className="text-gray-500 text-sm">为了使用高质量图像生成和 Veo 视频功能，请选择付费项目的 API 密钥。</p>
          </div>
          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            选择 API 密钥
          </button>
          <p className="text-[10px] text-gray-400">
            注意：您必须在 Google Cloud 项目中启用结算功能。
            <a href="https://ai.google.dev/gemini-api/docs/billing" className="ml-1 underline" target="_blank">了解更多</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen apple-gradient pb-20 relative">
      {state.isGlobalLoading && (
        <div className="fixed inset-0 z-[60] glass flex items-center justify-center bg-white/50">
           <AppleLoader message="正在智能分析文档并构建镜头..." />
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white text-xs font-bold">A</div>
            <h1 className="text-lg font-semibold tracking-tight">分镜视觉概念师 Agent 4</h1>
          </div>
          <div className="flex items-center gap-4">
             <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.txt,.md" 
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-50 transition-all"
            >
              📄 导入分解表 (PDF/TXT)
            </button>
            <button 
              onClick={addShot}
              className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:opacity-80 transition-all"
            >
              添加新镜头
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        <div className="mb-12">
          <h2 className="text-5xl font-semibold tracking-tighter mb-4 text-gray-900">苹果视觉哲学</h2>
          <p className="text-xl text-gray-500 max-w-2xl font-light">将逻辑化的分镜脚本转化为具有极简主义、优雅感和精神内敛的高端电影概念视觉。</p>
        </div>

        <div className="space-y-12">
          {state.shots.map((shot) => {
            const hasStartEnd = shot.keyframes.find(f => f.type === FrameType.START)?.imageUrl && 
                                shot.keyframes.find(f => f.type === FrameType.END)?.imageUrl;
            
            return (
              <section key={shot.id} className="group glass p-8 rounded-3xl shadow-sm hover:shadow-md transition-all duration-500">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Info Column */}
                  <div className="lg:w-1/3 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold bg-white">
                        {shot.index}
                      </span>
                      <h3 className="text-xl font-medium">镜头分解表</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">导演意图 / 描述</label>
                        <textarea 
                          className="w-full bg-transparent border-none p-0 text-gray-800 text-lg leading-snug focus:ring-0 resize-none"
                          value={shot.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setState(prev => ({
                              ...prev,
                              shots: prev.shots.map(s => s.id === shot.id ? { ...s, description: val } : s)
                            }));
                          }}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">视觉对标</label>
                        <p className="text-sm text-gray-500 italic">“{shot.visualReference}”</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => generateFrames(shot.id)}
                        className="w-full py-3 bg-black text-white rounded-xl text-sm font-medium hover:scale-[1.02] transition-transform active:scale-95 shadow-xl"
                      >
                        生成起止视觉图
                      </button>
                      
                      <button 
                        disabled={!hasStartEnd}
                        onClick={() => handleGenerateTransitions(shot.id)}
                        className={`w-full py-3 border border-gray-200 rounded-xl text-sm font-medium transition-all ${
                          hasStartEnd 
                            ? 'bg-white text-black hover:bg-gray-50 shadow-sm' 
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        生成连贯中间帧
                      </button>
                    </div>
                  </div>

                  {/* Gallery Column */}
                  <div className="lg:w-2/3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {shot.keyframes.map(frame => (
                        <FrameCard 
                          key={frame.id} 
                          frame={frame} 
                          onAnimate={() => handleAnimate(shot.id, frame.id)}
                          onEdit={(prompt) => handleEdit(shot.id, frame.id, prompt)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Floating Action Bar */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="glass px-8 py-4 rounded-full shadow-2xl flex items-center gap-8 border border-white/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">镜头总数</span>
            <span className="text-lg font-bold">{state.shots.length}</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <button className="text-sm font-medium hover:text-blue-600 transition-colors">导出 PDF</button>
          <button className="text-sm font-medium hover:text-blue-600 transition-colors">协作</button>
          <button className="px-5 py-2 bg-black text-white rounded-full text-sm font-medium hover:opacity-80 transition-all">
            查看画廊
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
