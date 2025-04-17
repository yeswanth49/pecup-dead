// app/archive/coming-soon/page.tsx

import React from 'react';
import ChatBubble from '@/components/ChatBubble'

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Coming Soon!</h1>
      <p className="text-lg text-gray-600 mb-8">
        This page will be uploaded shortly. Please check back later.
      </p>
      {/* You can add any additional elements or styling here */}
      <p className="text-sm text-gray-500">
        We appreciate your patience.
      </p>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  );
}