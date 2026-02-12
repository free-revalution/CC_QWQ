interface CommandMenuProps {
    isVisible: boolean;
    position: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    onSelect: (command: string) => void;
    onClose: () => void;
}
export default function CommandMenu({ isVisible, position, onSelect, onClose, }: CommandMenuProps): import("react/jsx-runtime").JSX.Element | null;
export {};
