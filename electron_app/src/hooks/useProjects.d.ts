import type { Project } from '../types';
/**
 * 项目管理 Hook
 * 管理最近项目列表的读取、保存和更新
 */
export declare function useProjects(): {
    projects: Project[];
    addProject: (path: string, name: string) => void;
    removeProject: (path: string) => void;
    clearProjects: () => void;
};
