interface FileReferenceMenuProps {
    isVisible: boolean;
    position: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    onSelect: (path: string) => void;
    onClose: () => void;
    projectPath: string | null;
}
export default function FileReferenceMenu({ isVisible, position, onSelect, onClose, projectPath, }: FileReferenceMenuProps): import("react/jsx-runtime").JSX.Element | null;
export {};
