
import React from 'react';

export const AppleLoader: React.FC<{ message?: string }> = ({ message = "正在合成概念..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 glass rounded-2xl">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">{message}</p>
    </div>
  );
};
