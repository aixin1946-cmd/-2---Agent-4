
import React, { useState } from 'react';
import { Frame, FrameType } from '../types';
import { AppleLoader } from './AppleLoader';

interface FrameCardProps {
  frame: Frame;
  onAnimate: () => void;
  onEdit: (prompt: string) => void;
}

export const FrameCard: React.FC<FrameCardProps> = ({ frame, onAnimate, onEdit }) => {
  const [editInput, setEditInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const getFrameLabel = (type: FrameType) => {
    switch (type) {
      case FrameType.START: return '首帧';
      case FrameType.END: return '尾帧';
      case FrameType.MID: return '中帧';
      default: return type;
    }
  };

  return (
    <div className="group relative flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100">
      <div className="absolute top-3 left-3 z-10">
        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${
          frame.type === FrameType.START ? 'bg-blue-500 text-white' : 
          frame.type === FrameType.END ? 'bg-purple-500 text-white' : 'bg-gray-500 text-white'
        }`}>
          {getFrameLabel(frame.type)}
        </span>
      </div>

      <div className="aspect-video relative overflow-hidden bg-gray-50 flex items-center justify-center">
        {frame.isGenerating ? (
          <AppleLoader />
        ) : frame.videoUrl ? (
          <video src={frame.videoUrl} controls className="w-full h-full object-cover" autoPlay loop muted />
        ) : frame.imageUrl ? (
          <img src={frame.imageUrl} alt="分镜预览" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="text-gray-300 italic text-sm">暂无预览图像</div>
        )}

        {frame.isAnimating && (
          <div className="absolute inset-0 glass flex items-center justify-center z-20">
            <AppleLoader message="正在生成动画..." />
          </div>
        )}
      </div>

      <div className="p-4 bg-white">
        {frame.imageUrl && !frame.videoUrl && !frame.isAnimating && (
          <div className="flex flex-col gap-2">
            <button 
              onClick={onAnimate}
              className="w-full py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              使用 Veo 动画化
            </button>
            
            <div className="mt-2">
              {isEditing ? (
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={editInput}
                    onChange={(e) => setEditInput(e.target.value)}
                    placeholder="例如：添加复古滤镜..."
                    className="w-full px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { onEdit(editInput); setIsEditing(false); }}
                      className="flex-1 py-1.5 bg-gray-100 rounded-md text-xs font-medium hover:bg-gray-200"
                    >
                      应用
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-1.5 text-gray-400 text-xs"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  使用 Gemini 编辑
                </button>
              )}
            </div>
          </div>
        )}
        
        {frame.videoUrl && (
          <div className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
             动画已就绪
          </div>
        )}
      </div>
    </div>
  );
};
