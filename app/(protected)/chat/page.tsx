'use client';

import { useChat } from '@ai-sdk/react';
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
    Message,
    MessageContent,
    MessageResponse,
} from '@/components/ai-elements/message';
import {
    PromptInput,
    PromptInputProvider,
    PromptInputTextarea,
    PromptInputActionAddAttachments,
    PromptInputFooter,
    PromptInputTools,
    PromptInputSubmit,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
} from '@/components/ai-elements/prompt-input';
import { BotIcon } from 'lucide-react';

function ChatContent() {
    const { messages, sendMessage, isLoading } = useChat();

    const onSubmit = async (message: { text: string; files: any[] }) => {
        if (message.text.trim() || message.files.length > 0) {
            await sendMessage({
                role: 'user',
                content: message.text,
            } as any);
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
            <Conversation className="w-full max-w-2xl flex-1">
                <ConversationContent>
                    {messages.length === 0 && (
                        <ConversationEmptyState
                            icon={<BotIcon className="size-10" />}
                            title="How can I help you today?"
                            description="Ask me anything about your academic data."
                        />
                    )}
                    {messages.map((m) => (
                        <Message key={m.id} from={m.role === 'user' ? 'user' : 'assistant'}>
                            <MessageContent>
                                {m.role === 'user' ? (
                                    m.content
                                ) : (
                                    <MessageResponse>{m.content}</MessageResponse>
                                )}
                            </MessageContent>
                        </Message>
                    ))}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="w-full max-w-2xl p-4">
                <PromptInput onSubmit={onSubmit}>
                    <PromptInputTextarea
                        placeholder="Type a message..."
                    />
                    <PromptInputFooter>
                        <PromptInputTools>
                            <PromptInputActionMenu>
                                <PromptInputActionMenuTrigger />
                                <PromptInputActionMenuContent>
                                    <PromptInputActionAddAttachments />
                                </PromptInputActionMenuContent>
                            </PromptInputActionMenu>
                        </PromptInputTools>
                        <PromptInputSubmit status={isLoading ? 'streaming' : 'ready'} />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <PromptInputProvider>
            <ChatContent />
        </PromptInputProvider>
    );
}
