import type { Client } from '@libsql/client';
import type { Project } from '../types.js';
export declare function createProject(client: Client, name: string, opts?: {
    rate?: number;
    currency?: string;
    min_block_minutes?: number;
}): Promise<Project>;
export declare function updateProject(client: Client, nameOrId: string | number, updates: {
    rate?: number;
    currency?: string;
    min_block_minutes?: number;
    archived?: boolean;
}): Promise<Project>;
export declare function getProjectById(client: Client, id: number): Promise<Project | null>;
export declare function getProjectByName(client: Client, name: string): Promise<Project | null>;
export declare function getProject(client: Client, nameOrId: string | number): Promise<Project | null>;
export declare function getOrCreateProject(client: Client, name: string, opts?: {
    rate?: number;
    currency?: string;
    min_block_minutes?: number;
}): Promise<Project>;
export declare function listProjects(client: Client, includeArchived?: boolean): Promise<Project[]>;
export declare function renameProject(client: Client, oldName: string, newName: string): Promise<Project>;
export declare function deleteProject(client: Client, name: string, opts?: {
    force?: boolean;
}): Promise<void>;
export declare function mergeProjects(client: Client, sourceName: string, targetName: string): Promise<{
    sessionsMoved: number;
    target: Project;
}>;
export interface ProjectDeleteImpact {
    project_name: string;
    has_active_timer: boolean;
    sessions_count: number;
    pauses_count: number;
    requires_force: boolean;
}
export declare function getProjectDeleteImpact(client: Client, name: string): Promise<ProjectDeleteImpact>;
export interface ProjectMergeImpact {
    source: string;
    target: string;
    blocked_by_active_timer: boolean;
    sessions_to_move: number;
}
export declare function getProjectMergeImpact(client: Client, sourceName: string, targetName: string): Promise<ProjectMergeImpact>;
/**
 * Returns active projects whose names are similar to the given name.
 * Normalises names by lowercasing and stripping spaces before comparison,
 * so "BoldBathroom" and "Bold Bathroom" are treated as identical.
 */
export declare function findSimilarProjects(client: Client, name: string, threshold?: number): Promise<Project[]>;
