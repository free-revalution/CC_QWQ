interface GitStatusPanelProps {
    projectPath: string | null;
    visible: boolean;
    onClose: () => void;
}
export default function GitStatusPanel({ projectPath, visible, onClose }: GitStatusPanelProps): import("react/jsx-runtime").JSX.Element | null;
export {};
