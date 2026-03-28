'use client';

import { Trash2 } from 'lucide-react';
import { ModelSelector, type ModelSelection } from './model-selector';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { ChatSettings } from '@/hooks/use-chat';

interface SettingsPanelProps {
    settings: ChatSettings;
    onSettingsChange: (settings: Partial<ChatSettings>) => void;
    onClear: () => void;
    hasMessages: boolean;
}

export function SettingsPanel({ settings, onSettingsChange, onClear, hasMessages }: SettingsPanelProps) {
    const handleModelChange = (modelSelection: ModelSelection) => {
        onSettingsChange({ modelSelection });
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold">Settings</h3>
                <p className="text-sm text-muted-foreground">Configure model and parameters</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Model</Label>
                    <ModelSelector
                        value={settings.modelSelection}
                        onChange={handleModelChange}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Temperature</Label>
                        <span className="text-sm text-muted-foreground">
                            {settings.temperature.toFixed(1)}
                        </span>
                    </div>
                    <Slider
                        value={[settings.temperature]}
                        onValueChange={([temperature]) => onSettingsChange({ temperature })}
                        min={0}
                        max={2}
                        step={0.1}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Max Tokens</Label>
                        <span className="text-sm text-muted-foreground">
                            {settings.maxTokens}
                        </span>
                    </div>
                    <Slider
                        value={[settings.maxTokens]}
                        onValueChange={([maxTokens]) => onSettingsChange({ maxTokens })}
                        min={100}
                        max={4096}
                        step={100}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Cache</Label>
                        <p className="text-xs text-muted-foreground">
                            Use cached responses when available
                        </p>
                    </div>
                    <Switch
                        checked={settings.cacheEnabled}
                        onCheckedChange={cacheEnabled => onSettingsChange({ cacheEnabled })}
                    />
                </div>
            </div>

            <div className="pt-4 border-t">
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={onClear}
                    disabled={!hasMessages}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Conversation
                </Button>
            </div>
        </div>
    );
}
