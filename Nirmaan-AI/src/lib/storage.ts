import { type WebsiteData } from "../services/geminiService";

export interface NirmaanProject {
  id: string;
  name: string;
  timestamp: number;
  data: WebsiteData;
  prompt: string;
}

export const StorageSystem = {
  saveProject: (project: NirmaanProject) => {
    try {
      const projects = StorageSystem.getProjects();
      const existing = projects.findIndex(p => p.id === project.id);
      if(existing > -1) {
          projects[existing] = project;
      } else {
          projects.push(project);
      }
      localStorage.setItem('nirmaan_projects', JSON.stringify(projects));
      localStorage.setItem('nirmaan_last_project_id', project.id);
    } catch (e) {
      console.warn("Storage error (quota exceeded?):", e);
    }
  },
  getProjects: (): NirmaanProject[] => {
    try {
      const data = localStorage.getItem('nirmaan_projects');
      return data ? JSON.parse(data) : [];
    } catch { 
      return []; 
    }
  },
  getLastProject: (): NirmaanProject | null => {
    const id = localStorage.getItem('nirmaan_last_project_id');
    if (!id) return null;
    return StorageSystem.getProjects().find(p => p.id === id) || null;
  },
  saveMemory: (mistake: string) => {
    const mems = StorageSystem.getMemory();
    if(!mems.includes(mistake)) {
      mems.push(mistake);
      localStorage.setItem('nirmaan_memory', JSON.stringify(mems));
    }
  },
  getMemory: (): string[] => {
    try { 
      const dict = localStorage.getItem('nirmaan_memory');
      return dict ? JSON.parse(dict) : []; 
    } 
    catch { return []; }
  }
};
