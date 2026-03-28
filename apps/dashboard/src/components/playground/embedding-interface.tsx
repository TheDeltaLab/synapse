'use client';

import { Loader2, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiKeyInput } from './api-key-input';
import { EmbeddingModelSelector } from './embedding-model-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useEmbeddings } from '@/hooks/use-embeddings';

// Number of vector values to show before truncating
const VECTOR_PREVIEW_COUNT = 8;

export function EmbeddingInterface() {
    const [apiKey, setApiKey] = useState('');
    const [inputText, setInputText] = useState('');
    const { result, isLoading, error, latency, settings, sendEmbedding, clearResults, updateSettings } = useEmbeddings();
    const hasModelSelection = Boolean(settings.modelSelection.provider && settings.modelSelection.model);

    const handleSubmit = () => {
        if (!apiKey.trim() || !inputText.trim() || !hasModelSelection) return;
        sendEmbedding(inputText, apiKey);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleDimensionsChange = (value: string) => {
        const num = parseInt(value, 10);
        updateSettings({ dimensions: isNaN(num) || num <= 0 ? null : num });
    };

    return (
        <div className="flex h-full">
            {/* Settings Sidebar */}
            <div className="w-80 border-r bg-card p-4 overflow-y-auto">
                <div className="space-y-6">
                    <ApiKeyInput apiKey={apiKey} onApiKeyChange={setApiKey} />

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold">Settings</h3>
                            <p className="text-sm text-muted-foreground">Configure embedding parameters</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <EmbeddingModelSelector
                                    value={settings.modelSelection}
                                    onChange={modelSelection => updateSettings({ modelSelection })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Dimensions</Label>
                                <Input
                                    type="number"
                                    placeholder="Auto (model default)"
                                    value={settings.dimensions ?? ''}
                                    onChange={e => handleDimensionsChange(e.target.value)}
                                    min={1}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Optional. Override the output dimensions.
                                </p>
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
                                    onCheckedChange={cacheEnabled => updateSettings({ cacheEnabled })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                clearResults();
                                setInputText('');
                            }}
                            disabled={!result && !inputText}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear Results
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="flex-1 p-6 space-y-6">
                    {/* Input Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-medium">Input Text</Label>
                        <Textarea
                            placeholder="Enter text to generate embeddings..."
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={4}
                            className="resize-y"
                        />
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Press Ctrl+Enter (Cmd+Enter) to submit
                            </p>
                            <Button
                                onClick={handleSubmit}
                                disabled={isLoading || !apiKey.trim() || !inputText.trim() || !hasModelSelection}
                            >
                                {isLoading
                                    ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        )
                                    : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" />
                                                Generate Embedding
                                            </>
                                        )}
                            </Button>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            {/* Usage & Metadata */}
                            <div className="grid gap-4 md:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Model</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm font-mono">{settings.modelSelection.model}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Tokens</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{result.usage.tokens.toLocaleString()}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Dimensions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">
                                            {result.embedding.length.toLocaleString()}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">
                                            {latency !== null ? `${latency}ms` : '-'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Vector Preview */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Embedding Vector
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md bg-muted p-3">
                                        <code className="text-xs font-mono break-all">
                                            [
                                            {result.embedding.slice(0, VECTOR_PREVIEW_COUNT).map((v, i) => (
                                                <span key={i}>
                                                    {i > 0 && ', '}
                                                    <span className="text-blue-600 dark:text-blue-400">
                                                        {v.toFixed(8)}
                                                    </span>
                                                </span>
                                            ))}
                                            {result.embedding.length > VECTOR_PREVIEW_COUNT && (
                                                <span className="text-muted-foreground">
                                                    {`, ...${(result.embedding.length - VECTOR_PREVIEW_COUNT).toLocaleString()} more`}
                                                </span>
                                            )}
                                            ]
                                        </code>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !error && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-muted p-4 mb-4">
                                <Send className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium">No Embeddings Yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-md">
                                Enter some text and click &quot;Generate Embedding&quot; to see the vector representation.
                                Make sure you have entered a valid API key.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
