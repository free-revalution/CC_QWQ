/**
 * Bot Settings Component
 *
 * Configuration UI for WhatsApp/Feishu bot integration
 */
interface BotConfig {
    whatsapp: {
        enabled: boolean;
        connected: boolean;
        conversationId?: string;
    };
    feishu: {
        enabled: boolean;
        connected: boolean;
        conversationId?: string;
    };
}
interface BotSettingsProps {
    onConfigChange?: (config: BotConfig) => void;
}
export default function BotSettings({ onConfigChange }: BotSettingsProps): import("react/jsx-runtime").JSX.Element;
export {};
