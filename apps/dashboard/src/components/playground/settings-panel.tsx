'use client';

import { Trash2 } from 'lucide-react';
import type { ProviderInfo } from '@synapse/shared';
import { ModelSelector, type ModelSelection } from './model-selector';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { ChatSettings, ResponseStyle } from '@/hooks/use-chat';

interface SettingsPanelProps {
    settings: ChatSettings;
    providers: ProviderInfo[];
    onSettingsChange: (settings: Partial<ChatSettings>) => void;
    onClear: () => void;
    hasMessages: boolean;
}

const STYLE_LABELS: Record<ResponseStyle, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
};

export function SettingsPanel({ settings, providers, onSettingsChange, onClear, hasMessages }: SettingsPanelProps) {
    const handleModelChange = (modelSelection: ModelSelection) => {
        onSettingsChange({ modelSelection });
    };

    const currentProvider = providers.find(p => p.id === settings.modelSelection.provider);
    const styles = currentProvider?.responseStyles ?? [];
    const showStyleSelector = styles.length > 1;

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

                {showStyleSelector && (
                    <div className="space-y-2">
                        <Label>Response Style</Label>
                        <Select
                            value={settings.responseStyle || undefined}
                            onValueChange={value => onSettingsChange({ responseStyle: value as ResponseStyle })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                                {styles.map(style => (
                                    <SelectItem key={style} value={style}>
                                        {STYLE_LABELS[style]}
                                        {style === currentProvider?.defaultResponseStyle ? ' (native)' : ' (compat)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Picks the upstream API shape (request body + path).
                        </p>
                    </div>
                )}

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
