import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Mic, Bot, User, AlertTriangle } from 'lucide-react';
import { sendChatMessage, formatConversationHistory } from '@/lib/api/tami';
import type { ChatResponse, ChatMode, SuggestedAction } from '@/lib/api/types';
import ReactMarkdown from 'react-markdown';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: ChatMode;
  suggestedActions?: SuggestedAction[];
  showScenarioBanner?: boolean;
}

const examplePrompts = [
  "What happens if I lose a client?",
  "How much runway do I have?",
  "What clients are most likely to pay late?",
];

export default function Tami() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || !user) return;

    // Add user message
    const userMessage: DisplayMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for the API
      const conversationHistory = formatConversationHistory(
        messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }))
      );

      // Send to TAMI API
      const response: ChatResponse = await sendChatMessage({
        user_id: user.id,
        message: text,
        conversation_history: conversationHistory,
        active_scenario_id: activeScenarioId,
      });

      // Add assistant message
      const assistantMessage: DisplayMessage = {
        role: 'assistant',
        content: response.response.message_markdown,
        timestamp: new Date(),
        mode: response.response.mode,
        suggestedActions: response.response.ui_hints.suggested_actions,
        showScenarioBanner: response.response.ui_hints.show_scenario_banner,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update active scenario if in build_scenario mode
      if (response.response.mode === 'build_scenario') {
        // Extract scenario ID from context if available
        const scenarioId = (response.context_summary as Record<string, string | undefined>)?.active_scenario_id;
        if (scenarioId) {
          setActiveScenarioId(scenarioId);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: DisplayMessage = {
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        mode: 'clarify',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleActionClick = async (action: SuggestedAction) => {
    if (action.action === 'none') {
      // Dismiss action - do nothing
      return;
    }

    if (action.action === 'call_tool' && action.tool_name && action.tool_args) {
      // Build a message that will trigger the tool
      const toolMessage = `[Action: ${action.label}] Please execute: ${action.tool_name} with parameters: ${JSON.stringify(action.tool_args)}`;
      await handleSend(toolMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModeLabel = (mode?: ChatMode): string => {
    switch (mode) {
      case 'explain_forecast':
        return 'Explaining';
      case 'suggest_scenarios':
        return 'Suggesting';
      case 'build_scenario':
        return 'Building Scenario';
      case 'goal_planning':
        return 'Planning';
      case 'clarify':
        return 'Clarifying';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Ask TAMI</h1>
        {activeScenarioId && (
          <Badge variant="outline" className="border-lime text-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Scenario Mode
          </Badge>
        )}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            // Empty state with example prompts
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">How can I help?</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                I can answer questions about your cash flow forecast, help you run what-if scenarios,
                and plan toward financial goals.
              </p>
              <div className="grid gap-3 w-full max-w-md">
                {examplePrompts.map((prompt, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSend(prompt)}
                  >
                    <CardContent className="p-3 text-sm text-center">
                      "{prompt}"
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            // Message list
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2'
                        : 'space-y-3'
                    }`}
                  >
                    {message.role === 'assistant' && message.mode && (
                      <Badge variant="secondary" className="text-xs mb-2">
                        {getModeLabel(message.mode)}
                      </Badge>
                    )}

                    {message.role === 'assistant' && message.showScenarioBanner && (
                      <div className="p-2 bg-lime/20 rounded-lg text-sm mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-foreground" />
                        <span>Scenario editing mode active</span>
                      </div>
                    )}

                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}

                    {/* Suggested Actions */}
                    {message.role === 'assistant' &&
                      message.suggestedActions &&
                      message.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {message.suggestedActions.map((action, actionIndex) => (
                            <Button
                              key={actionIndex}
                              variant={action.action === 'none' ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleActionClick(action)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              disabled
              title="Voice input coming soon"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
