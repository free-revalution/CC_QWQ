interface FileSearchPanelProps {
    projectPath: string | null;
    visible: boolean;
    onClose: () => void;
    onInsertReference?: (filePath: string, line?: number) => void;
}
export default function FileSearchPanel({ projectPath, visible, onClose, onInsertReference, }: FileSearchPanelProps): import("react/jsx-runtime").JSX.Element | null;
export {};
