'use client';

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PROVIDERS, MODELS, type Provider } from '@/lib/constants';

interface ModelSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
                {PROVIDERS.map(provider => (
                    <SelectGroup key={provider}>
                        <SelectLabel className="capitalize">{provider}</SelectLabel>
                        {MODELS[provider as Provider].map(model => (
                            <SelectItem key={model} value={model}>
                                {model}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}
