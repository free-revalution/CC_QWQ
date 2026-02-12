interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
    className?: string;
}
export default function CodeBlock({ code, language, filename, className }: CodeBlockProps): import("react/jsx-runtime").JSX.Element;
export {};
