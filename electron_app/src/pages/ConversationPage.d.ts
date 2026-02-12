export type FilterMode = 'talk' | 'develop';
interface ConversationPageProps {
    projectPath: string | null;
    onOpenSettings: () => void;
}
export default function ConversationPage({ projectPath, onOpenSettings, }: ConversationPageProps): import("react/jsx-runtime").JSX.Element;
export {};
