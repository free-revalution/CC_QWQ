import type { Project } from '../types';
interface ProjectOpenPageProps {
    recentProjects: Project[];
    onProjectSelect: (path: string, name: string) => void;
    onRemoveProject?: (path: string) => void;
}
export default function ProjectOpenPage({ recentProjects, onProjectSelect, onRemoveProject, }: ProjectOpenPageProps): import("react/jsx-runtime").JSX.Element;
export {};
